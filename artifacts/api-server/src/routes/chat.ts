import { Router, type IRouter } from "express";
import { db, chatMessagesTable, usersTable, notificationsTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { requireAuth } from "./auth";
import { broadcast, sendToUser } from "./sse";

const OWNER_USERNAME = "cylax";
const COOLDOWN_MS = 3000;
const lastMessageTime = new Map<number, number>();

const router: IRouter = Router();

router.get("/chat/messages", async (_req, res) => {
  try {
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    const messages = await db.select().from(chatMessagesTable).orderBy(desc(chatMessagesTable.createdAt)).limit(50);
    const reversed = messages.reverse();

    // Gather unique userIds and fetch their current avatars in one query
    const uniqueUserIds = [...new Set(reversed.map((m) => m.userId))];
    const userMeta: Record<number, { avatar: string | null; level: number }> = {};
    if (uniqueUserIds.length > 0) {
      const allUsers = await Promise.all(
        uniqueUserIds.map((uid) =>
          db.select({ id: usersTable.id, avatar: usersTable.avatar, level: usersTable.level })
            .from(usersTable)
            .where(eq(usersTable.id, uid))
            .limit(1)
            .then((r) => r[0])
        )
      );
      for (const u of allUsers) {
        if (u) userMeta[u.id] = { avatar: u.avatar, level: u.level ?? 1 };
      }
    }

    res.json(reversed.map((m) => ({
      id: String(m.id),
      userId: String(m.userId),
      username: m.username,
      avatar: userMeta[m.userId]?.avatar ?? null,
      level: userMeta[m.userId]?.level ?? 1,
      message: m.message,
      createdAt: m.createdAt?.toISOString(),
    })));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/chat/messages", requireAuth, async (req: any, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim().length === 0) {
      res.status(400).json({ error: "Message cannot be empty" });
      return;
    }
    if (message.length > 200) {
      res.status(400).json({ error: "Message too long" });
      return;
    }

    const now = Date.now();
    const last = lastMessageTime.get(req.user.id) ?? 0;
    const elapsed = now - last;
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      res.status(429).json({ error: `Please wait ${remaining}s before sending another message.`, remaining });
      return;
    }

    // Check if user is muted
    const [userData] = await db.select({ mutedUntil: usersTable.mutedUntil })
      .from(usersTable).where(eq(usersTable.id, req.user.id)).limit(1);
    if (userData?.mutedUntil && new Date() < new Date(userData.mutedUntil)) {
      const remainingMs = new Date(userData.mutedUntil).getTime() - now;
      const remainingSecs = Math.ceil(remainingMs / 1000);
      const mins = Math.floor(remainingSecs / 60);
      const secs = remainingSecs % 60;
      const timeStr = mins > 0
        ? `${mins} minute${mins !== 1 ? "s" : ""} ${secs} second${secs !== 1 ? "s" : ""}`
        : `${secs} second${secs !== 1 ? "s" : ""}`;
      res.status(403).json({ error: `You have been muted for ${timeStr}.` });
      return;
    }

    lastMessageTime.set(req.user.id, now);

    const trimmed = message.trim();

    // Owner-only /tip command: /tip @username amount
    if (req.user.username.toLowerCase() === OWNER_USERNAME && /^\/tip\s+@\S+\s+[\d.]+$/i.test(trimmed)) {
      const match = trimmed.match(/^\/tip\s+@(\S+)\s+([\d.]+)$/i);
      if (match) {
        const targetUsername = match[1];
        const amount = parseFloat(match[2]);

        if (!isNaN(amount) && amount > 0) {
          const allUsers = await db.select({ id: usersTable.id, username: usersTable.username })
            .from(usersTable);
          const target = allUsers.find((u) => u.username.toLowerCase() === targetUsername.toLowerCase());

          if (target && target.id !== req.user.id) {
            await db.update(usersTable)
              .set({ balance: sql`${usersTable.balance} + ${amount}` })
              .where(eq(usersTable.id, target.id));

            await db.insert(notificationsTable).values({
              userId: target.id,
              type: "tip",
              message: `${req.user.username} gifted you ${amount.toLocaleString()} DL!`,
            });

            sendToUser(target.id, "notification", {
              type: "tip",
              message: `${req.user.username} gifted you ${amount.toLocaleString()} DL!`,
            });

            const giftMessage = `🎁 Gifted ${amount.toLocaleString()} DL to @${target.username}!`;
            const [msg] = await db.insert(chatMessagesTable).values({
              userId: req.user.id,
              username: req.user.username,
              avatar: req.user.avatar,
              message: giftMessage,
            }).returning();

            const chatPayload = {
              id: String(msg.id),
              userId: String(msg.userId),
              username: msg.username,
              avatar: msg.avatar,
              level: req.user.level ?? 1,
              message: msg.message,
              createdAt: msg.createdAt?.toISOString(),
            };
            broadcast("chat_message", chatPayload);
            res.json(chatPayload);
            return;
          }
        }

        // Invalid command — return error only visible as a response, not saved to chat
        res.status(400).json({ error: "Invalid /tip command. Usage: /tip @username amount" });
        return;
      }
    }

    // Owner-only /add command: /add amount  — adds DL to Cylax's own balance
    if (req.user.username.toLowerCase() === OWNER_USERNAME && /^\/add\s+[\d.]+$/i.test(trimmed)) {
      const match = trimmed.match(/^\/add\s+([\d.]+)$/i);
      if (match) {
        const amount = parseFloat(match[1]);
        if (!isNaN(amount) && amount > 0) {
          await db.update(usersTable)
            .set({ balance: sql`${usersTable.balance} + ${amount}` })
            .where(eq(usersTable.id, req.user.id));
          res.json({ system: true, message: `✅ Added ${amount.toLocaleString()} DL to your balance.` });
          return;
        }
      }
      res.status(400).json({ error: "Invalid /add command. Usage: /add amount" });
      return;
    }

    // Block /add for non-owners
    if (/^\/add\b/i.test(trimmed) && req.user.username.toLowerCase() !== OWNER_USERNAME) {
      res.status(403).json({ error: "Unknown command." });
      return;
    }

    // Block /tip for non-owners silently
    if (/^\/tip\b/i.test(trimmed) && req.user.username.toLowerCase() !== OWNER_USERNAME) {
      res.status(403).json({ error: "Only the owner can use /tip." });
      return;
    }

    const [msg] = await db.insert(chatMessagesTable).values({
      userId: req.user.id,
      username: req.user.username,
      avatar: req.user.avatar,
      message: trimmed,
    }).returning();

    const chatPayload = {
      id: String(msg.id),
      userId: String(msg.userId),
      username: msg.username,
      avatar: msg.avatar,
      level: req.user.level ?? 1,
      message: msg.message,
      createdAt: msg.createdAt?.toISOString(),
    };
    // Push to all SSE clients instantly
    broadcast("chat_message", chatPayload);

    // Detect @username mentions and notify each mentioned user
    const mentionMatches = [...trimmed.matchAll(/@([a-zA-Z0-9_]+)/g)];
    if (mentionMatches.length > 0) {
      const lowered = new Set(mentionMatches.map((m) => m[1].toLowerCase()));
      const allUsers = await db
        .select({ id: usersTable.id, username: usersTable.username })
        .from(usersTable);
      const toNotify = allUsers.filter(
        (u) => u.id !== req.user.id && lowered.has(u.username.toLowerCase())
      );
      if (toNotify.length > 0) {
        await db.insert(notificationsTable).values(
          toNotify.map((u) => ({
            userId: u.id,
            type: "mention",
            message: `${req.user.username} mentioned you in chat!`,
          }))
        );
        // Push mention notifications via SSE instantly
        for (const u of toNotify) {
          sendToUser(u.id, "notification", {
            type: "mention",
            message: `${req.user.username} mentioned you in chat!`,
          });
        }
      }
    }

    res.json(chatPayload);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
