/**
 * Bot webhook endpoints — called by the Growtopia bot script running externally.
 *
 * All requests must include the header:
 *   X-Bot-Secret: <BOT_SECRET env var>
 *
 * Endpoints:
 *   POST /api/bot/deposit-complete   — bot confirmed a player traded items
 *   GET  /api/bot/pending-withdrawals — bot polls for withdrawals to process
 *   POST /api/bot/withdraw-complete   — bot confirms it sent items to player
 */
import { Router, type IRouter } from "express";
import { db, walletTransactionsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

function requireBotSecret(req: any, res: any, next: any) {
  const secret = process.env["BOT_SECRET"];
  if (!secret) {
    res.status(503).json({ error: "Bot secret not configured on server" });
    return;
  }
  const provided = req.headers["x-bot-secret"] ?? req.query.secret;
  if (provided !== secret) {
    res.status(401).json({ error: "Invalid bot secret" });
    return;
  }
  next();
}

// ── Bot: claim a deposit session (assigns this bot's GrowID to the world) ────
// Body: { worldName: string, botGrowId: string }
// Call this as soon as the bot enters the world and is ready to trade.
router.post("/bot/claim-deposit", requireBotSecret, async (req: any, res) => {
  try {
    const { worldName, botGrowId } = req.body ?? {};
    if (!worldName || !botGrowId) {
      res.status(400).json({ error: "worldName and botGrowId required" });
      return;
    }

    const [tx] = await db.select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.worldName, worldName))
      .limit(1);

    if (!tx) {
      res.status(404).json({ error: "No deposit session found for this world" });
      return;
    }
    if (tx.status !== "pending") {
      res.status(409).json({ error: "Deposit already processed" });
      return;
    }

    await db.update(walletTransactionsTable)
      .set({ botGrowId })
      .where(eq(walletTransactionsTable.id, tx.id));

    res.json({ ok: true, transactionId: tx.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Bot: confirm deposit received ────────────────────────────────────────────
// Body: { worldName: string, amountDl: number }
// The bot calls this after a player trades items at the deposit world.
router.post("/bot/deposit-complete", requireBotSecret, async (req: any, res) => {
  try {
    const { worldName, amountDl } = req.body ?? {};
    if (!worldName || !amountDl) {
      res.status(400).json({ error: "worldName and amountDl required" });
      return;
    }
    const amount = parseFloat(amountDl);
    if (!amount || amount <= 0) {
      res.status(400).json({ error: "Invalid amountDl" });
      return;
    }
    if (amount > 3000) {
      res.status(400).json({ error: "Exceeds max deposit of 3,000 DL" });
      return;
    }

    // Find the pending deposit for this world
    const [pending] = await db.select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.worldName, worldName))
      .limit(1);

    if (!pending) {
      res.status(404).json({ error: "No pending deposit found for this world" });
      return;
    }
    if (pending.status !== "pending") {
      res.status(409).json({ error: "Deposit already processed" });
      return;
    }

    // Credit balance and mark complete
    await db.transaction(async (tx) => {
      await tx.update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${amount}` })
        .where(eq(usersTable.id, pending.userId));

      await tx.update(walletTransactionsTable)
        .set({ status: "completed", amountDl: amount, completedAt: new Date() })
        .where(eq(walletTransactionsTable.id, pending.id));
    });

    res.json({ ok: true, userId: pending.userId, amountDl: amount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Bot: get pending withdrawals to process ───────────────────────────────────
router.get("/bot/pending-withdrawals", requireBotSecret, async (_req, res) => {
  try {
    const pending = await db.select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.status, "pending"))
      .limit(50);

    const withdrawals = pending.filter((t) => t.type === "withdrawal");
    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Bot: confirm withdrawal delivered ────────────────────────────────────────
// Body: { transactionId: number }
router.post("/bot/withdraw-complete", requireBotSecret, async (req: any, res) => {
  try {
    const { transactionId } = req.body ?? {};
    if (!transactionId) {
      res.status(400).json({ error: "transactionId required" });
      return;
    }

    const [tx] = await db.select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.id, parseInt(transactionId)))
      .limit(1);

    if (!tx || tx.type !== "withdrawal") {
      res.status(404).json({ error: "Withdrawal not found" });
      return;
    }
    if (tx.status !== "pending") {
      res.status(409).json({ error: "Withdrawal already processed" });
      return;
    }

    await db.update(walletTransactionsTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(walletTransactionsTable.id, tx.id));

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Bot: mark withdrawal as failed (refund balance) ──────────────────────────
// Body: { transactionId: number }
router.post("/bot/withdraw-failed", requireBotSecret, async (req: any, res) => {
  try {
    const { transactionId } = req.body ?? {};
    if (!transactionId) {
      res.status(400).json({ error: "transactionId required" });
      return;
    }

    const [tx] = await db.select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.id, parseInt(transactionId)))
      .limit(1);

    if (!tx || tx.type !== "withdrawal") {
      res.status(404).json({ error: "Withdrawal not found" });
      return;
    }
    if (tx.status !== "pending") {
      res.status(409).json({ error: "Withdrawal already processed" });
      return;
    }

    // Refund the balance and mark failed
    await db.transaction(async (t) => {
      await t.update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${tx.amountDl}` })
        .where(eq(usersTable.id, tx.userId));

      await t.update(walletTransactionsTable)
        .set({ status: "failed", completedAt: new Date() })
        .where(eq(walletTransactionsTable.id, tx.id));
    });

    res.json({ ok: true, refunded: tx.amountDl });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
