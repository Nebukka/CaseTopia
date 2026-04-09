import { Router, type IRouter } from "express";
import { db, usersTable, notificationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "./auth";
import { sendToUser } from "./sse";

const router: IRouter = Router();

const CURRENCY_TO_DL: Record<string, number> = {
  WL: 0.01,
  DL: 1,
  BGL: 100,
};

const OWNER_USERNAME = "cylax";

router.post("/users/:id/mute", requireAuth, async (req: any, res) => {
  try {
    if (req.user.username.toLowerCase() !== OWNER_USERNAME) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const targetId = parseInt(req.params.id, 10);
    if (isNaN(targetId)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    if (targetId === req.user.id) {
      res.status(400).json({ error: "Cannot mute yourself" });
      return;
    }
    const { minutes } = req.body as { minutes: number };
    if (!minutes || !isFinite(Number(minutes)) || Number(minutes) <= 0) {
      res.status(400).json({ error: "Invalid duration" });
      return;
    }
    const mutedUntil = new Date(Date.now() + Math.round(Number(minutes)) * 60 * 1000);
    await db.update(usersTable).set({ mutedUntil }).where(eq(usersTable.id, targetId));
    res.json({ success: true, mutedUntil: mutedUntil.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:id/tip", requireAuth, async (req: any, res) => {
  try {
    const recipientId = parseInt(req.params.id, 10);
    const senderId = req.user.id;

    if (isNaN(recipientId)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    if (recipientId === senderId) {
      res.status(400).json({ error: "You cannot tip yourself" });
      return;
    }

    const { amount, currency = "DL" } = req.body as { amount: number; currency?: string };
    if (!amount || !isFinite(Number(amount)) || Number(amount) <= 0) {
      res.status(400).json({ error: "Invalid tip amount" });
      return;
    }

    const rate = CURRENCY_TO_DL[currency];
    if (!rate) {
      res.status(400).json({ error: "Invalid currency. Use WL, DL, or BGL." });
      return;
    }

    const amountInDL = parseFloat((Number(amount) * rate).toFixed(4));
    if (amountInDL < 0.0001) {
      res.status(400).json({ error: "Tip amount too small" });
      return;
    }
    if (req.user.balance < amountInDL) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }

    const recipients = await db.select().from(usersTable).where(eq(usersTable.id, recipientId)).limit(1);
    if (!recipients.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const amountDisplay = currency === "DL"
      ? `${Number(amount).toLocaleString()} DL`
      : currency === "WL"
        ? `${Number(amount).toLocaleString()} WL (${amountInDL} DL)`
        : `${Number(amount).toLocaleString()} BGL (${amountInDL} DL)`;

    const notifMsg = `${req.user.username} tipped you ${amountDisplay}!`;

    await db.transaction(async (tx) => {
      await tx.update(usersTable)
        .set({ balance: sql`${usersTable.balance} - ${amountInDL}` })
        .where(eq(usersTable.id, senderId));
      await tx.update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${amountInDL}` })
        .where(eq(usersTable.id, recipientId));
      await tx.insert(notificationsTable).values({
        userId: recipientId,
        type: "tip",
        message: notifMsg,
      });
    });

    // Push tip notification to recipient instantly via SSE
    sendToUser(recipientId, "notification", { type: "tip", message: notifMsg });

    res.json({ success: true, amountInDL, currency, amount: Number(amount), recipient: recipients[0].username });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/by-username/:username", async (req, res) => {
  try {
    const username = req.params.username;
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(sql`LOWER(${usersTable.username})`, username.toLowerCase()))
      .limit(1);
    if (!users.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const u = users[0];
    const netProfit = u.balance != null ? parseFloat((u.balance - 1000).toFixed(2)) : null;
    res.json({
      id: String(u.id),
      username: u.username,
      avatar: u.avatar,
      level: u.level,
      balance: u.balance,
      netProfit,
      totalWagered: u.totalWagered,
      allTimeLow: u.allTimeLow,
      allTimeHigh: u.allTimeHigh,
      createdAt: u.createdAt?.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    const users = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!users.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const u = users[0];
    const netProfit = u.balance != null ? parseFloat((u.balance - 1000).toFixed(2)) : null;
    res.json({
      id: String(u.id),
      username: u.username,
      avatar: u.avatar,
      level: u.level,
      balance: u.balance,
      netProfit,
      totalWagered: u.totalWagered,
      allTimeLow: u.allTimeLow,
      allTimeHigh: u.allTimeHigh,
      createdAt: u.createdAt?.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
