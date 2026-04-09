import { Router, type IRouter } from "express";
import { db, walletTransactionsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "./auth";

const router: IRouter = Router();

function generateWorldName(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return "BET" + Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── User: start a deposit session ────────────────────────────────────────────
router.post("/wallet/deposit", requireAuth, async (req: any, res) => {
  try {
    const { growId } = req.body ?? {};
    if (!growId?.trim()) {
      res.status(400).json({ error: "GrowID is required" });
      return;
    }

    const worldName = generateWorldName();

    const [tx] = await db.insert(walletTransactionsTable).values({
      userId: req.user.id,
      growId: growId.trim(),
      type: "deposit",
      amountDl: 0, // filled in when bot confirms
      status: "pending",
      worldName,
    }).returning();

    res.json({ transactionId: tx.id, worldName });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── User: request a withdrawal ───────────────────────────────────────────────
router.post("/wallet/withdraw", requireAuth, async (req: any, res) => {
  try {
    const { growId, amountDl } = req.body ?? {};
    if (!growId?.trim()) {
      res.status(400).json({ error: "GrowID is required" });
      return;
    }
    const amount = parseFloat(amountDl);
    if (!amount || amount <= 0) {
      res.status(400).json({ error: "Invalid amount" });
      return;
    }
    if (amount > 2000) {
      res.status(400).json({ error: "Maximum withdrawal is 2,000 DL at a time" });
      return;
    }
    if (req.user.balance < amount) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }

    // Deduct balance and create pending withdrawal in one transaction
    const [tx] = await db.transaction(async (t) => {
      await t.update(usersTable)
        .set({ balance: sql`${usersTable.balance} - ${amount}` })
        .where(eq(usersTable.id, req.user.id));

      return t.insert(walletTransactionsTable).values({
        userId: req.user.id,
        growId: growId.trim(),
        type: "withdrawal",
        amountDl: amount,
        status: "pending",
      }).returning();
    });

    const [updated] = await db.select({ balance: usersTable.balance })
      .from(usersTable).where(eq(usersTable.id, req.user.id)).limit(1);

    res.json({ transactionId: tx.id, newBalance: updated.balance });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── User: poll deposit session status (to get bot GrowID once assigned) ──────
router.get("/wallet/deposit-status/:id", requireAuth, async (req: any, res) => {
  try {
    const [tx] = await db.select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.id, parseInt(req.params.id)))
      .limit(1);

    if (!tx || tx.userId !== req.user.id) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ status: tx.status, botGrowId: tx.botGrowId, amountDl: tx.amountDl });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── User: get their wallet transaction history ───────────────────────────────
router.get("/wallet/history", requireAuth, async (req: any, res) => {
  try {
    const txs = await db.select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.userId, req.user.id))
      .orderBy(sql`${walletTransactionsTable.createdAt} DESC`)
      .limit(50);
    res.json(txs);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
