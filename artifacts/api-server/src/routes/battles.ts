import { Router, type IRouter } from "express";
import { db, battlesTable, casesTable, usersTable } from "@workspace/db";
import { eq, or, lte } from "drizzle-orm";
import { requireAuth } from "./auth";
import type { CaseItem } from "@workspace/db";
import type { BattlePlayer, BattleRound, BattleItem } from "@workspace/db";

const router: IRouter = Router();

// ─── Game mode helpers ─────────────────────────────────────────────────────

const GAME_MODES: Record<string, { maxPlayers: number; teams: number; playersPerTeam: number }> = {
  "1v1":   { maxPlayers: 2, teams: 2, playersPerTeam: 1 },
  "1v1v1": { maxPlayers: 3, teams: 3, playersPerTeam: 1 },
  "2v2":   { maxPlayers: 4, teams: 2, playersPerTeam: 2 },
  "2v2v2": { maxPlayers: 6, teams: 3, playersPerTeam: 2 },
  "3v3":   { maxPlayers: 6, teams: 2, playersPerTeam: 3 },
};

function getTeamIndex(slotIndex: number, gameMode: string): number {
  const mode = GAME_MODES[gameMode];
  if (!mode) return slotIndex;
  return Math.floor(slotIndex / mode.playersPerTeam);
}

function rollItem(items: CaseItem[]): CaseItem {
  const total = items.reduce((s, i) => s + i.chance, 0);
  const rand = Math.random() * total;
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.chance;
    if (rand < cumulative) return item;
  }
  return items[items.length - 1];
}

function pickRandomFromTied(totals: Record<number, number>): { winnerTeamIndex: number; isDraw: boolean } {
  const max = Math.max(...Object.values(totals));
  const tied = Object.keys(totals).map(Number).filter((k) => totals[k] === max);
  const isDraw = tied.length > 1;
  const winnerTeamIndex = tied[Math.floor(Math.random() * tied.length)];
  return { winnerTeamIndex, isDraw };
}

function runBattle(players: BattlePlayer[], caseIds: number[], casesById: Record<number, any>, battleType = "normal"): {
  rounds: BattleRound[];
  updatedPlayers: BattlePlayer[];
  winnerTeamIndex: number;
  winnerPlayer: BattlePlayer | undefined;
  isDraw: boolean;
} {
  const rounds: BattleRound[] = [];
  const playerTotals: Record<number, number> = {};
  for (const p of players) playerTotals[p.userId] = 0;

  for (let i = 0; i < caseIds.length; i++) {
    const caseId = caseIds[i];
    const c = casesById[caseId];
    if (!c) continue;
    const items = c.items as CaseItem[];
    const results = players.map((p) => {
      const item = rollItem(items);
      playerTotals[p.userId] = (playerTotals[p.userId] || 0) + item.value;
      return { userId: p.userId, item };
    });
    rounds.push({ roundNumber: i + 1, caseId, results });
  }

  let winnerTeamIndex: number;
  let isDraw: boolean;

  if (battleType === "top_pull") {
    const playerBest: Record<number, number> = {};
    for (const round of rounds) {
      for (const res of round.results) {
        playerBest[res.userId] = Math.max(playerBest[res.userId] || 0, res.item.value);
      }
    }
    const teamBest: Record<number, number> = {};
    for (const p of players) {
      teamBest[p.teamIndex] = Math.max(teamBest[p.teamIndex] || 0, playerBest[p.userId] || 0);
    }
    ({ winnerTeamIndex, isDraw } = pickRandomFromTied(teamBest));
  } else if (battleType === "terminal") {
    const lastRound = rounds[rounds.length - 1];
    const teamLast: Record<number, number> = {};
    for (const p of players) teamLast[p.teamIndex] = 0;
    if (lastRound) {
      for (const res of lastRound.results) {
        const player = players.find((pp) => pp.userId === res.userId);
        if (player) teamLast[player.teamIndex] = Math.max(teamLast[player.teamIndex] || 0, res.item.value);
      }
    }
    ({ winnerTeamIndex, isDraw } = pickRandomFromTied(teamLast));
  } else if (battleType === "crazy") {
    // Lowest total wins — invert all values so pickRandomFromTied still picks the "highest"
    const teamTotals: Record<number, number> = {};
    for (const p of players) {
      teamTotals[p.teamIndex] = (teamTotals[p.teamIndex] || 0) + (playerTotals[p.userId] || 0);
    }
    const maxVal = Math.max(...Object.values(teamTotals));
    const inverted: Record<number, number> = {};
    for (const [k, v] of Object.entries(teamTotals)) inverted[Number(k)] = maxVal - v;
    ({ winnerTeamIndex, isDraw } = pickRandomFromTied(inverted));
  } else {
    const teamTotals: Record<number, number> = {};
    for (const p of players) {
      teamTotals[p.teamIndex] = (teamTotals[p.teamIndex] || 0) + (playerTotals[p.userId] || 0);
    }
    ({ winnerTeamIndex, isDraw } = pickRandomFromTied(teamTotals));
  }

  const updatedPlayers = players.map((p) => ({
    ...p,
    items: rounds.flatMap((r) => r.results.filter((res) => res.userId === p.userId).map((res) => res.item)),
    totalValue: playerTotals[p.userId] || 0,
  }));

  const winnerPlayer = updatedPlayers.find((p) => p.teamIndex === winnerTeamIndex && p.userId > 0)
    ?? updatedPlayers.find((p) => p.teamIndex === winnerTeamIndex);

  return { rounds, updatedPlayers, winnerTeamIndex, winnerPlayer, isDraw };
}

async function payWinners(updatedPlayers: BattlePlayer[], winnerTeamIndex: number, totalPrize: number, borrowPercent = 0, creatorUserId?: number) {
  const winnerRealPlayers = updatedPlayers.filter((p) => p.teamIndex === winnerTeamIndex && p.userId > 0);
  if (winnerRealPlayers.length === 0) return;
  const prizeEach = Math.floor(totalPrize / winnerRealPlayers.length);
  for (const w of winnerRealPlayers) {
    const isCreator = creatorUserId != null && w.userId === creatorUserId;
    const actualPrize = isCreator && borrowPercent > 0
      ? Math.floor(prizeEach * (1 - borrowPercent / 100))
      : prizeEach;
    const current = await db.select().from(usersTable).where(eq(usersTable.id, w.userId)).limit(1);
    if (current[0]) {
      await db.update(usersTable).set({ balance: current[0].balance + actualPrize }).where(eq(usersTable.id, w.userId));
    }
  }
}

async function payShared(updatedPlayers: BattlePlayer[], totalPrize: number) {
  const realPlayers = updatedPlayers.filter((p) => p.userId > 0);
  if (realPlayers.length === 0) return;
  const prizeEach = Math.floor(totalPrize / realPlayers.length);
  for (const p of realPlayers) {
    const current = await db.select().from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
    if (current[0]) {
      await db.update(usersTable).set({ balance: current[0].balance + prizeEach }).where(eq(usersTable.id, p.userId));
    }
  }
}

function formatBattle(b: any, cases: any[]) {
  const casesById: Record<number, any> = {};
  for (const c of cases) casesById[c.id] = c;
  const caseIds = b.caseIds as number[];
  const players = (b.players as BattlePlayer[]);
  // Sort by slotIndex so they always appear in order
  const sortedPlayers = [...players].sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));
  return {
    id: String(b.id),
    status: b.status,
    gameMode: b.gameMode || "1v1",
    cases: caseIds.map((id: number) => casesById[id] ? {
      id: String(casesById[id].id),
      name: casesById[id].name,
      imageUrl: casesById[id].imageUrl,
      price: casesById[id].price,
      category: casesById[id].category,
      items: casesById[id].items,
    } : null).filter(Boolean),
    players: sortedPlayers.map((p) => ({
      userId: String(p.userId),
      username: p.username,
      avatar: p.avatar,
      items: p.items || [],
      totalValue: p.totalValue,
      teamIndex: p.teamIndex ?? 0,
      slotIndex: p.slotIndex ?? 0,
      isBot: p.userId < 0,
    })),
    maxPlayers: b.maxPlayers,
    totalValue: b.totalValue,
    isShared: b.isShared ?? false,
    battleType: b.battleType ?? "normal",
    borrowPercent: b.borrowPercent ?? 0,
    isDraw: b.isDraw ?? false,
    winnerId: b.winnerId ? String(b.winnerId) : undefined,
    winnerTeamIndex: b.winnerTeamIndex ?? undefined,
    rounds: (b.rounds as BattleRound[]) || [],
    createdAt: b.createdAt?.toISOString(),
  };
}

// ─── Routes ────────────────────────────────────────────────────────────────

router.get("/battles", async (_req, res) => {
  try {
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    const battles = await db.select().from(battlesTable).orderBy(battlesTable.createdAt);
    const cases = await db.select().from(casesTable);
    res.json(battles.map((b) => formatBattle(b, cases)));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/battles/:id", async (req, res) => {
  try {
    const battles = await db.select().from(battlesTable).where(eq(battlesTable.id, parseInt(req.params.id))).limit(1);
    if (!battles.length) { res.status(404).json({ error: "Battle not found" }); return; }
    const cases = await db.select().from(casesTable);
    res.json(formatBattle(battles[0], cases));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/battles", requireAuth, async (req: any, res) => {
  try {
    const { caseIds, gameMode = "1v1", botSlots = [], isShared = false, battleType = "normal", borrowPercent: rawBorrow = 0 } = req.body;
    const borrowPercent = Math.min(80, Math.max(0, parseInt(rawBorrow) || 0));
    const modeConfig = GAME_MODES[gameMode];
    if (!modeConfig) { res.status(400).json({ error: "Invalid game mode" }); return; }
    if (!caseIds || !Array.isArray(caseIds) || caseIds.length === 0) {
      res.status(400).json({ error: "Must select at least one case" }); return;
    }

    const numericCaseIds = caseIds.map((id: string) => parseInt(id));
    // botSlots = array of slot indices (≥1) that should be bots
    const validBotSlots: number[] = (Array.isArray(botSlots) ? botSlots : [])
      .map(Number)
      .filter((s: number) => s >= 1 && s < modeConfig.maxPlayers);

    const allCases = await db.select().from(casesTable);
    const casesById: Record<number, any> = {};
    for (const c of allCases) casesById[c.id] = c;
    let costPerPlayer = 0;
    for (const id of numericCaseIds) {
      if (!casesById[id]) { res.status(400).json({ error: `Case ${id} not found` }); return; }
      costPerPlayer += casesById[id].price;
    }

    // Creator only pays for their own slot — bots are free (house-funded); borrow reduces upfront cost
    const totalCreatorCost = Math.floor(costPerPlayer * (1 - borrowPercent / 100));
    if (req.user.balance < totalCreatorCost) {
      res.status(400).json({ error: `Insufficient balance (need ${totalCreatorCost} 💎)` }); return;
    }

    // Build player list with explicit slotIndex for correct ordering
    const players: BattlePlayer[] = [];
    let botCount = 0;
    for (let i = 0; i < modeConfig.maxPlayers; i++) {
      const tIdx = getTeamIndex(i, gameMode);
      if (i === 0) {
        players.push({ userId: req.user.id, username: req.user.username, avatar: req.user.avatar, items: [], totalValue: 0, teamIndex: tIdx, slotIndex: i });
      } else if (validBotSlots.includes(i)) {
        botCount++;
        players.push({ userId: -(botCount), username: `Bot #${botCount}`, avatar: undefined, items: [], totalValue: 0, teamIndex: tIdx, slotIndex: i });
      }
      // open slots are not added until real players join
    }

    await db.update(usersTable)
      .set({ balance: req.user.balance - totalCreatorCost })
      .where(eq(usersTable.id, req.user.id));

    const effectiveBattleType = battleType || (isShared ? "shared" : "normal");

    // If all slots filled (creator + bots = maxPlayers), run immediately
    if (players.length === modeConfig.maxPlayers) {
      const { rounds, updatedPlayers, winnerTeamIndex, winnerPlayer, isDraw } = runBattle(players, numericCaseIds, casesById, effectiveBattleType);
      const totalPrize = costPerPlayer * modeConfig.maxPlayers;
      if (effectiveBattleType === "shared") {
        await payShared(updatedPlayers, totalPrize);
      } else {
        await payWinners(updatedPlayers, winnerTeamIndex, totalPrize, borrowPercent, req.user.id);
      }

      const [battle] = await db.insert(battlesTable).values({
        caseIds: numericCaseIds,
        players: updatedPlayers,
        maxPlayers: modeConfig.maxPlayers,
        totalValue: costPerPlayer,
        gameMode,
        battleType: effectiveBattleType,
        borrowPercent,
        status: "completed",
        isDraw,
        winnerId: effectiveBattleType === "shared" ? undefined : (winnerPlayer?.userId && winnerPlayer.userId > 0 ? winnerPlayer.userId : undefined),
        winnerTeamIndex: effectiveBattleType === "shared" ? undefined : winnerTeamIndex,
        rounds,
        completedAt: new Date(),
      }).returning();
      res.json(formatBattle(battle, allCases));
    } else {
      // Some open slots remain — create as waiting
      const [battle] = await db.insert(battlesTable).values({
        caseIds: numericCaseIds,
        players,
        maxPlayers: modeConfig.maxPlayers,
        totalValue: costPerPlayer,
        gameMode,
        battleType: effectiveBattleType,
        borrowPercent,
        status: "waiting",
        rounds: [],
      }).returning();
      res.json(formatBattle(battle, allCases));
    }
  } catch (err) {
    req.log?.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/battles/:id/join", requireAuth, async (req: any, res) => {
  try {
    const battles = await db.select().from(battlesTable).where(eq(battlesTable.id, parseInt(req.params.id))).limit(1);
    if (!battles.length) { res.status(404).json({ error: "Battle not found" }); return; }
    const battle = battles[0];
    if (battle.status !== "waiting") { res.status(400).json({ error: "Battle is not open for joining" }); return; }

    const players = battle.players as BattlePlayer[];
    if (players.length >= battle.maxPlayers) { res.status(400).json({ error: "Battle is full" }); return; }
    if (players.some((p) => p.userId === req.user.id)) { res.status(400).json({ error: "Already in this battle" }); return; }

    const allCases = await db.select().from(casesTable);
    const casesById: Record<number, any> = {};
    for (const c of allCases) casesById[c.id] = c;
    const caseIds = battle.caseIds as number[];
    let costPerPlayer = 0;
    for (const id of caseIds) { if (casesById[id]) costPerPlayer += casesById[id].price; }
    if (req.user.balance < costPerPlayer) { res.status(400).json({ error: "Insufficient balance" }); return; }

    await db.update(usersTable).set({ balance: req.user.balance - costPerPlayer }).where(eq(usersTable.id, req.user.id));

    // Find the first open slot index (not occupied by existing players)
    const gameMode = battle.gameMode || "1v1";
    const occupiedSlots = new Set(players.map((p) => p.slotIndex ?? 0));
    let newSlotIndex = 1;
    for (let i = 1; i < battle.maxPlayers; i++) {
      if (!occupiedSlots.has(i)) { newSlotIndex = i; break; }
    }

    const newPlayer: BattlePlayer = {
      userId: req.user.id,
      username: req.user.username,
      avatar: req.user.avatar,
      items: [],
      totalValue: 0,
      teamIndex: getTeamIndex(newSlotIndex, gameMode),
      slotIndex: newSlotIndex,
    };
    players.push(newPlayer);

    let updatedBattle: any;
    const effectiveBattleType = battle.battleType ?? (battle.isShared ? "shared" : "normal");
    const battleBorrowPercent = battle.borrowPercent ?? 0;
    if (players.length === battle.maxPlayers) {
      const sortedPlayers = [...players].sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));
      const creatorPlayer = sortedPlayers.find((p) => (p.slotIndex ?? 0) === 0);
      const { rounds, updatedPlayers, winnerTeamIndex, winnerPlayer, isDraw } = runBattle(sortedPlayers, caseIds, casesById, effectiveBattleType);
      const totalPrize = costPerPlayer * battle.maxPlayers;
      if (effectiveBattleType === "shared") {
        await payShared(updatedPlayers, totalPrize);
      } else {
        await payWinners(updatedPlayers, winnerTeamIndex, totalPrize, battleBorrowPercent, creatorPlayer?.userId);
      }

      [updatedBattle] = await db.update(battlesTable).set({
        players: updatedPlayers,
        status: "completed",
        isDraw,
        winnerId: effectiveBattleType === "shared" ? undefined : (winnerPlayer?.userId && winnerPlayer.userId > 0 ? winnerPlayer.userId : undefined),
        winnerTeamIndex: effectiveBattleType === "shared" ? undefined : winnerTeamIndex,
        rounds,
        completedAt: new Date(),
      }).where(eq(battlesTable.id, battle.id)).returning();
    } else {
      [updatedBattle] = await db.update(battlesTable).set({ players }).where(eq(battlesTable.id, battle.id)).returning();
    }
    res.json(formatBattle(updatedBattle, allCases));
  } catch (err) {
    req.log?.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Leave a waiting battle — refunds entry fee; creator leaving cancels the battle
router.post("/battles/:id/leave", requireAuth, async (req: any, res) => {
  try {
    const battles = await db.select().from(battlesTable).where(eq(battlesTable.id, parseInt(req.params.id))).limit(1);
    if (!battles.length) { res.status(404).json({ error: "Battle not found" }); return; }
    const battle = battles[0];
    if (battle.status !== "waiting") { res.status(400).json({ error: "Can only leave a waiting battle" }); return; }

    const players = battle.players as BattlePlayer[];
    const leavingPlayer = players.find((p) => p.userId === req.user.id);
    if (!leavingPlayer) { res.status(400).json({ error: "You are not in this battle" }); return; }

    const costPerPlayer = battle.totalValue;

    // Refund the leaving player
    const current = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id)).limit(1);
    if (current[0]) {
      await db.update(usersTable).set({ balance: current[0].balance + costPerPlayer }).where(eq(usersTable.id, req.user.id));
    }

    const isCreator = leavingPlayer.slotIndex === 0;
    if (isCreator) {
      // Creator leaving → cancel the battle and refund all other real players
      const otherRealPlayers = players.filter((p) => p.userId !== req.user.id && p.userId > 0);
      for (const op of otherRealPlayers) {
        const opUser = await db.select().from(usersTable).where(eq(usersTable.id, op.userId)).limit(1);
        if (opUser[0]) {
          await db.update(usersTable).set({ balance: opUser[0].balance + costPerPlayer }).where(eq(usersTable.id, op.userId));
        }
      }
      await db.update(battlesTable).set({ status: "cancelled" }).where(eq(battlesTable.id, battle.id));
      res.json({ cancelled: true });
    } else {
      // Non-creator leaving → remove them from the players array
      const updatedPlayers = players.filter((p) => p.userId !== req.user.id);
      const allCases = await db.select().from(casesTable);
      const [updatedBattle] = await db.update(battlesTable).set({ players: updatedPlayers }).where(eq(battlesTable.id, battle.id)).returning();
      res.json(formatBattle(updatedBattle, allCases));
    }
  } catch (err) {
    req.log?.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add a bot to the next open slot — free of charge, creator only
router.post("/battles/:id/add-bot", requireAuth, async (req: any, res) => {
  try {
    const battles = await db.select().from(battlesTable).where(eq(battlesTable.id, parseInt(req.params.id))).limit(1);
    if (!battles.length) { res.status(404).json({ error: "Battle not found" }); return; }
    const battle = battles[0];
    if (battle.status !== "waiting") { res.status(400).json({ error: "Battle is not open" }); return; }

    const players = battle.players as BattlePlayer[];
    if (players.length >= battle.maxPlayers) { res.status(400).json({ error: "Battle is full" }); return; }

    // Only the creator (slot 0) can add bots
    const creator = players.find((p) => p.slotIndex === 0);
    if (!creator || creator.userId !== req.user.id) {
      res.status(403).json({ error: "Only the battle creator can add bots" }); return;
    }

    const allCases = await db.select().from(casesTable);
    const casesById: Record<number, any> = {};
    for (const c of allCases) casesById[c.id] = c;
    const caseIds = battle.caseIds as number[];
    const gameMode = battle.gameMode || "1v1";

    // Find next open slot
    const occupiedSlots = new Set(players.map((p) => p.slotIndex ?? 0));
    let newSlotIndex = -1;
    for (let i = 1; i < battle.maxPlayers; i++) {
      if (!occupiedSlots.has(i)) { newSlotIndex = i; break; }
    }
    if (newSlotIndex === -1) { res.status(400).json({ error: "No open slots" }); return; }

    // Count existing bots to get the next bot number
    const existingBots = players.filter((p) => p.userId < 0);
    const botNum = existingBots.length + 1;

    const botPlayer: BattlePlayer = {
      userId: -botNum,
      username: `Bot #${botNum}`,
      avatar: undefined,
      items: [],
      totalValue: 0,
      teamIndex: getTeamIndex(newSlotIndex, gameMode),
      slotIndex: newSlotIndex,
    };
    players.push(botPlayer);

    let updatedBattle: any;
    if (players.length === battle.maxPlayers) {
      // All slots filled — run immediately
      const sortedPlayers = [...players].sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));
      const { rounds, updatedPlayers, winnerTeamIndex, winnerPlayer, isDraw } = runBattle(sortedPlayers, caseIds, casesById);
      const costPerPlayer = battle.totalValue;
      const totalPrize = costPerPlayer * battle.maxPlayers;
      await payWinners(updatedPlayers, winnerTeamIndex, totalPrize);

      [updatedBattle] = await db.update(battlesTable).set({
        players: updatedPlayers,
        status: "completed",
        isDraw,
        winnerId: winnerPlayer?.userId && winnerPlayer.userId > 0 ? winnerPlayer.userId : undefined,
        winnerTeamIndex,
        rounds,
        completedAt: new Date(),
      }).where(eq(battlesTable.id, battle.id)).returning();
    } else {
      [updatedBattle] = await db.update(battlesTable).set({ players }).where(eq(battlesTable.id, battle.id)).returning();
    }
    res.json(formatBattle(updatedBattle, allCases));
  } catch (err) {
    req.log?.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Background cleanup: delete completed/cancelled battles older than 60s ──
async function cleanupOldBattles() {
  try {
    const cutoff = new Date(Date.now() - 60_000);
    await db.delete(battlesTable).where(
      or(
        lte(battlesTable.completedAt, cutoff),
        eq(battlesTable.status, "cancelled")
      )
    );
  } catch (_) {}
}

setInterval(cleanupOldBattles, 30_000);

export default router;
