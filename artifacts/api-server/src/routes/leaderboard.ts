import { Router, type IRouter } from "express";
import { db, usersTable, gameBetsTable, racePayoutsTable, notificationsTable } from "@workspace/db";
import { desc, gte, eq, sql } from "drizzle-orm";

const router: IRouter = Router();

const PRIZES = [300, 200, 100, 75, 75, 50, 50, 50, 50, 50];

function getRaceWindow() {
  const now = new Date();
  const today9am = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 0, 0, 0));
  let raceStart: Date;
  let raceEnd: Date;
  if (now >= today9am) {
    raceStart = today9am;
    raceEnd = new Date(today9am.getTime() + 24 * 60 * 60 * 1000);
  } else {
    raceStart = new Date(today9am.getTime() - 24 * 60 * 60 * 1000);
    raceEnd = today9am;
  }
  return { raceStart, raceEnd };
}

async function payoutCompletedRace() {
  const { raceStart } = getRaceWindow();

  // The previous completed race started 24h before the current race start
  const prevRaceStart = new Date(raceStart.getTime() - 24 * 60 * 60 * 1000);
  const prevRaceEnd = raceStart;

  // Check if it's already been paid out
  const existing = await db
    .select({ id: racePayoutsTable.id })
    .from(racePayoutsTable)
    .where(eq(racePayoutsTable.raceStartAt, prevRaceStart))
    .limit(1);

  if (existing.length > 0) return; // already paid

  // Fetch top 10 for the completed race window
  const rows = await db
    .select({
      userId: gameBetsTable.userId,
      username: gameBetsTable.username,
      wagered: sql<number>`sum(${gameBetsTable.amount})`.as("wagered"),
    })
    .from(gameBetsTable)
    .where(
      sql`${gameBetsTable.createdAt} >= ${prevRaceStart} AND ${gameBetsTable.createdAt} < ${prevRaceEnd}`
    )
    .groupBy(gameBetsTable.userId, gameBetsTable.username)
    .orderBy(sql`wagered desc`)
    .limit(10);

  if (rows.length === 0) {
    // No bets — still mark as paid so we don't retry
    await db.insert(racePayoutsTable).values({ raceStartAt: prevRaceStart });
    return;
  }

  // Credit each winner and send a notification
  for (let i = 0; i < rows.length; i++) {
    const prize = PRIZES[i] ?? 0;
    if (prize <= 0) continue;
    const row = rows[i];

    await db.update(usersTable)
      .set({ balance: sql`${usersTable.balance} + ${prize}` })
      .where(eq(usersTable.id, row.userId));

    await db.insert(notificationsTable).values({
      userId: row.userId,
      type: "tip",
      message: `🏆 Daily Race reward: You finished #${i + 1} and received ${prize.toLocaleString()} DL!`,
    });
  }

  // Record that this race has been paid out
  await db.insert(racePayoutsTable).values({ raceStartAt: prevRaceStart });
}

router.get("/leaderboard", async (_req, res) => {
  try {
    const users = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      avatar: usersTable.avatar,
      totalWagered: usersTable.totalWagered,
      level: usersTable.level,
    }).from(usersTable).orderBy(desc(usersTable.totalWagered)).limit(20);

    res.json(users.map((u) => ({
      userId: String(u.id),
      username: u.username,
      avatar: u.avatar,
      totalWagered: u.totalWagered,
      level: u.level,
    })));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/leaderboard/daily-race", async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    // Trigger payout for any completed race that hasn't been paid yet
    await payoutCompletedRace();

    const { raceStart, raceEnd } = getRaceWindow();

    const rows = await db
      .select({
        userId: gameBetsTable.userId,
        username: gameBetsTable.username,
        avatar: usersTable.avatar,
        level: usersTable.level,
        wagered: sql<number>`sum(${gameBetsTable.amount})`.as("wagered"),
      })
      .from(gameBetsTable)
      .leftJoin(usersTable, eq(usersTable.id, gameBetsTable.userId))
      .where(gte(gameBetsTable.createdAt, raceStart))
      .groupBy(gameBetsTable.userId, gameBetsTable.username, usersTable.avatar, usersTable.level)
      .orderBy(sql`wagered desc`)
      .limit(10);

    const leaders = rows.map((row, i) => ({
      rank: i + 1,
      userId: String(row.userId),
      username: row.username,
      avatar: row.avatar ?? undefined,
      level: row.level ?? 1,
      wagered: Number(row.wagered ?? 0),
      prize: PRIZES[i] ?? 0,
    }));

    res.json({ leaders, endsAt: raceEnd.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
