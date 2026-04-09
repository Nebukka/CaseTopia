import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { requireAuth } from "./auth";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req: any, res) => {
  try {
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, req.user.id), eq(notificationsTable.read, false)))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(20);

    res.json(rows.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      createdAt: n.createdAt?.toISOString(),
    })));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/notifications/mark-read", requireAuth, async (req: any, res) => {
  try {
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.userId, req.user.id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
