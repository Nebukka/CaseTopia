import { Router, type IRouter } from "express";
import { db, gameBetsTable, usersTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/bets/recent", async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const bets = await db
      .select({
        id: gameBetsTable.id,
        userId: gameBetsTable.userId,
        username: gameBetsTable.username,
        game: gameBetsTable.game,
        amount: gameBetsTable.amount,
        profit: gameBetsTable.profit,
        multiplier: gameBetsTable.multiplier,
        detail: gameBetsTable.detail,
        createdAt: gameBetsTable.createdAt,
        avatar: usersTable.avatar,
        level: usersTable.level,
      })
      .from(gameBetsTable)
      .leftJoin(usersTable, eq(usersTable.id, gameBetsTable.userId))
      .orderBy(desc(gameBetsTable.createdAt))
      .limit(50);

    res.json(
      bets.map((b) => ({
        id: String(b.id),
        userId: String(b.userId),
        username: b.username,
        game: b.game,
        amount: b.amount,
        profit: b.profit,
        multiplier: b.multiplier ?? null,
        detail: b.detail ?? null,
        createdAt: b.createdAt?.toISOString(),
        avatar: b.avatar ?? null,
        level: b.level ?? 1,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
