import { Router, type IRouter } from "express";
import { db, crashHistoryTable, minesGamesTable, usersTable, gameBetsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "./auth";
import { getLevelForWagered, getInstantRakebackPercent, HOUSE_EDGE } from "../lib/levels";

function calcRakeback(betAmount: number, level: number, game: string): number {
  const pct = getInstantRakebackPercent(level);
  const edge = HOUSE_EDGE[game] ?? 4;
  return parseFloat((betAmount * edge / 100 * pct / 100).toFixed(4));
}

const router: IRouter = Router();

// Crash Game
router.post("/crash/play", requireAuth, async (req: any, res) => {
  try {
    const { amount, autoCashout } = req.body;
    if (!amount || amount <= 0) {
      res.status(400).json({ error: "Invalid bet amount" });
      return;
    }
    if (req.user.balance < amount) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }
    // Generate crash point using provably fair-style algorithm
    const rand = Math.random();
    const crashPoint = Math.max(1, Math.floor(100 / (rand * 100 + 1) * 100) / 100);
    
    await db.insert(crashHistoryTable).values({ crashPoint });
    
    let cashedOut = false;
    let cashoutMultiplier = 1;
    let profit = -amount;
    
    if (autoCashout && autoCashout <= crashPoint) {
      cashedOut = true;
      cashoutMultiplier = autoCashout;
      profit = amount * autoCashout - amount;
    }
    
    const newBalance = req.user.balance - amount + (cashedOut ? amount * cashoutMultiplier : 0);
    const newTotalWageredCrash = req.user.totalWagered + amount;
    await db.update(usersTable).set({
      balance: newBalance,
      totalWagered: newTotalWageredCrash,
      level: getLevelForWagered(newTotalWageredCrash),
    }).where(eq(usersTable.id, req.user.id));

    await db.insert(gameBetsTable).values({
      userId: req.user.id,
      username: req.user.username,
      game: "crash",
      amount,
      profit,
      multiplier: cashedOut ? cashoutMultiplier : crashPoint,
      detail: cashedOut ? `Cashed out at ${cashoutMultiplier}x` : `Crashed at ${crashPoint}x`,
    });

    const rakebackCrash = calcRakeback(amount, req.user.level ?? 1, "crash");
    await db.update(usersTable)
      .set({ rakebackBalance: sql`${usersTable.rakebackBalance} + ${rakebackCrash}` })
      .where(eq(usersTable.id, req.user.id));

    res.json({ crashPoint, cashedOut, cashoutMultiplier, profit, newBalance, rakebackEarned: rakebackCrash, newLevel: getLevelForWagered(newTotalWageredCrash) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/crash/history", async (_req, res) => {
  try {
    const history = await db.select().from(crashHistoryTable).orderBy(desc(crashHistoryTable.createdAt)).limit(20);
    res.json(history.map((h) => ({
      id: String(h.id),
      crashPoint: h.crashPoint,
      createdAt: h.createdAt?.toISOString(),
    })));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Limbo Game
router.post("/limbo/play", requireAuth, async (req: any, res) => {
  try {
    const { amount, targetMultiplier } = req.body;
    if (!amount || amount <= 0) {
      res.status(400).json({ error: "Invalid bet amount" });
      return;
    }
    if (!targetMultiplier || targetMultiplier < 1.01) {
      res.status(400).json({ error: "Target multiplier must be at least 1.01x" });
      return;
    }
    if (req.user.balance < amount) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }
    const rand = Math.random();
    const result = Math.max(1, (1 / rand) * (1 - 0.01)); // ~1% house edge
    const win = result >= targetMultiplier;
    const profit = win ? amount * targetMultiplier - amount : -amount;
    const newBalance = req.user.balance + profit;
    const newTotalWageredLimbo = req.user.totalWagered + amount;
    await db.update(usersTable).set({
      balance: newBalance,
      totalWagered: newTotalWageredLimbo,
      level: getLevelForWagered(newTotalWageredLimbo),
    }).where(eq(usersTable.id, req.user.id));

    await db.insert(gameBetsTable).values({
      userId: req.user.id,
      username: req.user.username,
      game: "limbo",
      amount,
      profit,
      multiplier: Math.round(result * 100) / 100,
      detail: win ? `Hit ${Math.round(result * 100) / 100}x (target ${targetMultiplier}x)` : `Missed at ${Math.round(result * 100) / 100}x`,
    });

    const rakebackLimbo = calcRakeback(amount, req.user.level ?? 1, "limbo");
    await db.update(usersTable)
      .set({ rakebackBalance: sql`${usersTable.rakebackBalance} + ${rakebackLimbo}` })
      .where(eq(usersTable.id, req.user.id));

    res.json({ result: Math.round(result * 100) / 100, win, profit, newBalance, rakebackEarned: rakebackLimbo, newLevel: getLevelForWagered(newTotalWageredLimbo) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Mines Game
router.post("/mines/start", requireAuth, async (req: any, res) => {
  try {
    const { amount, mineCount } = req.body;
    if (!amount || amount <= 0) {
      res.status(400).json({ error: "Invalid bet amount" });
      return;
    }
    if (!mineCount || mineCount < 1 || mineCount > 24) {
      res.status(400).json({ error: "Mine count must be between 1 and 24" });
      return;
    }
    if (req.user.balance < amount) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }
    // Deduct bet immediately
    const newTotalWageredMines = req.user.totalWagered + amount;
    await db.update(usersTable).set({
      balance: req.user.balance - amount,
      totalWagered: newTotalWageredMines,
      level: getLevelForWagered(newTotalWageredMines),
    }).where(eq(usersTable.id, req.user.id));
    
    // Generate mine positions
    const positions = Array.from({ length: 25 }, (_, i) => i);
    const shuffled = positions.sort(() => Math.random() - 0.5);
    const minePositions = shuffled.slice(0, mineCount);
    
    const [game] = await db.insert(minesGamesTable).values({
      userId: req.user.id,
      amount,
      mineCount,
      minePositions,
      revealed: [],
      status: "active",
      currentMultiplier: 1,
    }).returning();
    
    res.json({
      gameId: String(game.id),
      mineCount,
      amount,
      revealed: [],
      currentMultiplier: 1,
      status: "active",
      newLevel: getLevelForWagered(newTotalWageredMines),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/mines/reveal", requireAuth, async (req: any, res) => {
  try {
    const { gameId, tileIndex } = req.body;
    if (gameId === undefined || tileIndex === undefined) {
      res.status(400).json({ error: "Game ID and tile index required" });
      return;
    }
    const games = await db.select().from(minesGamesTable).where(
      eq(minesGamesTable.id, parseInt(gameId))
    ).limit(1);
    if (!games.length) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    const game = games[0];
    if (game.userId !== req.user.id) {
      res.status(403).json({ error: "Not your game" });
      return;
    }
    if (game.status !== "active") {
      res.status(400).json({ error: "Game is not active" });
      return;
    }
    const minePositions = game.minePositions as number[];
    const revealed = game.revealed as number[];
    if (revealed.includes(tileIndex)) {
      res.status(400).json({ error: "Tile already revealed" });
      return;
    }
    const isMine = minePositions.includes(tileIndex);
    if (isMine) {
      await db.update(minesGamesTable).set({ status: "lost", revealed: [...revealed, tileIndex] }).where(eq(minesGamesTable.id, game.id));
      const users = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id)).limit(1);
      await db.insert(gameBetsTable).values({
        userId: req.user.id,
        username: req.user.username,
        game: "mines",
        amount: game.amount,
        profit: -game.amount,
        multiplier: 0,
        detail: `Hit a mine (${game.mineCount} mines)`,
      });
      const rakebackMineHit = calcRakeback(game.amount, req.user.level ?? 1, "mines");
      await db.update(usersTable)
        .set({ rakebackBalance: sql`${usersTable.rakebackBalance} + ${rakebackMineHit}` })
        .where(eq(usersTable.id, req.user.id));
      res.json({
        isMine: true,
        currentMultiplier: 0,
        newBalance: users[0]?.balance || 0,
        gameOver: true,
        minePositions,
        profit: -game.amount,
        rakebackEarned: rakebackMineHit,
      });
      return;
    }
    const newRevealed = [...revealed, tileIndex];
    const safeCount = newRevealed.length;
    const totalSafe = 25 - game.mineCount;
    // Calculate multiplier based on revealed safe tiles
    let multiplier = 1;
    for (let i = 0; i < safeCount; i++) {
      multiplier *= (25 - game.mineCount - i) / (25 - i) < 1
        ? 1 + (game.mineCount / (25 - game.mineCount - i + 1)) * 0.97
        : 1 + (game.mineCount / (25 - game.mineCount)) * 0.97;
    }
    multiplier = Math.round(multiplier * 100) / 100;
    await db.update(minesGamesTable).set({
      revealed: newRevealed,
      currentMultiplier: multiplier,
    }).where(eq(minesGamesTable.id, game.id));
    const users = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id)).limit(1);
    res.json({
      isMine: false,
      currentMultiplier: multiplier,
      newBalance: users[0]?.balance || 0,
      gameOver: false,
      profit: 0,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/mines/cashout", requireAuth, async (req: any, res) => {
  try {
    const games = await db.select().from(minesGamesTable).where(
      eq(minesGamesTable.userId, req.user.id)
    ).orderBy(desc(minesGamesTable.createdAt)).limit(1);
    if (!games.length || games[0].status !== "active") {
      res.status(400).json({ error: "No active mines game" });
      return;
    }
    const game = games[0];
    const profit = game.amount * game.currentMultiplier - game.amount;
    const newBalance = req.user.balance + game.amount * game.currentMultiplier;
    await db.update(usersTable).set({ balance: newBalance }).where(eq(usersTable.id, req.user.id));
    await db.update(minesGamesTable).set({ status: "won" }).where(eq(minesGamesTable.id, game.id));
    await db.insert(gameBetsTable).values({
      userId: req.user.id,
      username: req.user.username,
      game: "mines",
      amount: game.amount,
      profit,
      multiplier: game.currentMultiplier,
      detail: `Cashed out at ${game.currentMultiplier}x (${game.mineCount} mines)`,
    });
    const rakebackMineCash = calcRakeback(game.amount, req.user.level ?? 1, "mines");
    await db.update(usersTable)
      .set({ rakebackBalance: sql`${usersTable.rakebackBalance} + ${rakebackMineCash}` })
      .where(eq(usersTable.id, req.user.id));
    res.json({
      profit,
      newBalance,
      minePositions: game.minePositions as number[],
      rakebackEarned: rakebackMineCash,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
