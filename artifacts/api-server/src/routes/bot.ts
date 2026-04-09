/**
 * Bot webhook endpoints — called by the Growtopia bot script running externally.
 *
 * All requests must include either:
 *   Header:      X-Bot-Secret: <BOT_SECRET>
 *   Query param: ?secret=<BOT_SECRET>
 *
 * GET endpoints support ?format=text which returns pipe-separated lines
 * instead of JSON (for Lua clients without a JSON library).
 *
 * POST endpoints accept both JSON body AND query params.
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

// ── Bot: claim a deposit session ─────────────────────────────────────────────
// Params: worldName, botGrowId  (body JSON or query string)
router.post("/bot/claim-deposit", requireBotSecret, async (req: any, res) => {
  try {
    const worldName = String(req.body?.worldName ?? req.query.worldName ?? "");
    const botGrowId = String(req.body?.botGrowId ?? req.query.botGrowId ?? "");
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
// Params: worldName, amountDl  (body JSON or query string)
router.post("/bot/deposit-complete", requireBotSecret, async (req: any, res) => {
  try {
    const worldName = String(req.body?.worldName ?? req.query.worldName ?? "");
    const rawAmount = req.body?.amountDl ?? req.query.amountDl;
    if (!worldName || !rawAmount) {
      res.status(400).json({ error: "worldName and amountDl required" });
      return;
    }
    const amount = parseFloat(rawAmount);
    if (!amount || amount <= 0) {
      res.status(400).json({ error: "Invalid amountDl" });
      return;
    }
    if (amount > 3000) {
      res.status(400).json({ error: "Exceeds max deposit of 3,000 DL" });
      return;
    }

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

// ── Bot: cancel/expire a deposit session ─────────────────────────────────────
// Params: worldName  (body JSON or query string)
// Marks the deposit as "failed" so the player can start a fresh one.
router.post("/bot/cancel-deposit", requireBotSecret, async (req: any, res) => {
  try {
    const worldName = String(req.body?.worldName ?? req.query.worldName ?? "");
    if (!worldName) {
      res.status(400).json({ error: "worldName required" });
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
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(walletTransactionsTable.id, tx.id));

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Bot: get pending deposits ─────────────────────────────────────────────────
// ?format=text  →  one line per deposit: worldName|growId|userId
// (default)     →  JSON array
router.get("/bot/pending-deposits", requireBotSecret, async (req: any, res) => {
  try {
    const now = new Date();
    const pending = await db.select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.status, "pending"))
      .limit(50);

    const deposits = pending.filter((t) =>
      t.type === "deposit" &&
      (!t.expiresAt || t.expiresAt > now) &&
      !t.botGrowId
    );

    if (req.query.format === "text") {
      const lines = deposits.map((d) =>
        `${d.worldName}|${d.growId ?? ""}|${d.userId}`
      );
      res.type("text/plain").send(lines.join("\n"));
    } else {
      res.json(deposits);
    }
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Bot: get pending withdrawals ──────────────────────────────────────────────
// ?format=text  →  one line per withdrawal: id|growId|amountDl
// (default)     →  JSON array
router.get("/bot/pending-withdrawals", requireBotSecret, async (req: any, res) => {
  try {
    const pending = await db.select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.status, "pending"))
      .limit(50);

    const withdrawals = pending.filter((t) => t.type === "withdrawal");

    if (req.query.format === "text") {
      const lines = withdrawals.map((w) =>
        `${w.id}|${w.growId ?? ""}|${w.amountDl ?? 0}`
      );
      res.type("text/plain").send(lines.join("\n"));
    } else {
      res.json(withdrawals);
    }
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Bot: confirm withdrawal delivered ────────────────────────────────────────
// Params: transactionId  (body JSON or query string)
router.post("/bot/withdraw-complete", requireBotSecret, async (req: any, res) => {
  try {
    const rawId = req.body?.transactionId ?? req.query.transactionId;
    if (!rawId) {
      res.status(400).json({ error: "transactionId required" });
      return;
    }

    const [tx] = await db.select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.id, parseInt(rawId)))
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
// Params: transactionId  (body JSON or query string)
router.post("/bot/withdraw-failed", requireBotSecret, async (req: any, res) => {
  try {
    const rawId = req.body?.transactionId ?? req.query.transactionId;
    if (!rawId) {
      res.status(400).json({ error: "transactionId required" });
      return;
    }

    const [tx] = await db.select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.id, parseInt(rawId)))
      .limit(1);

    if (!tx || tx.type !== "withdrawal") {
      res.status(404).json({ error: "Withdrawal not found" });
      return;
    }
    if (tx.status !== "pending") {
      res.status(409).json({ error: "Withdrawal already processed" });
      return;
    }

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
