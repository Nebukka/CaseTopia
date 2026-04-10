import { Router, type IRouter } from "express";
import { db, usersTable, gameBetsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "./auth";
import { getLevelForWagered } from "../lib/levels";

const router: IRouter = Router();

const ROWS = 5;
const COLS = 6;
const MIN_CLUSTER = 8;

const SYM = {
  RED: 0, BLUE: 1, PURPLE: 2, APPLE: 3, PLUM: 4,
  WATERMELON: 5, GRAPE: 6, LOLLIPOP: 7, SCATTER: 8, MULT: 9,
} as const;

// Pay table: multiplier of bet for clusters of 8, 9, 10, 11, 12+ symbols
const PAY: Record<number, number[]> = {
  [SYM.RED]:        [0.2,  0.3,  0.4,  0.5,  0.8],
  [SYM.BLUE]:       [0.3,  0.4,  0.5,  0.6,  1.0],
  [SYM.PURPLE]:     [0.5,  0.6,  0.8,  1.0,  1.5],
  [SYM.APPLE]:      [0.8,  1.0,  1.2,  1.5,  2.0],
  [SYM.PLUM]:       [1.0,  1.2,  1.5,  2.0,  3.0],
  [SYM.WATERMELON]: [1.5,  2.0,  2.5,  3.0,  4.0],
  [SYM.GRAPE]:      [2.0,  2.5,  3.0,  4.0,  5.0],
  [SYM.LOLLIPOP]:   [8.0, 10.0, 12.0, 15.0, 20.0],
};

// Weights for base game [RED, BLUE, PURPLE, APPLE, PLUM, WATERMELON, GRAPE, LOLLIPOP, SCATTER]
const BASE_W = [8, 7, 6, 5, 4, 3, 2, 1, 0.5];
// Weights for free spins (+ MULT)
const FREE_W = [7, 6, 5, 4, 3, 2, 2, 1, 0.5, 1.5];

const MULT_VALUES = [2, 3, 5, 8, 10, 25, 50, 100];

function weightedRand(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function genSym(isFS: boolean): number {
  return weightedRand(isFS ? FREE_W : BASE_W);
}

function genGrid(isFS: boolean): number[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => genSym(isFS))
  );
}

function countScatters(grid: number[][]): number {
  let n = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c] === SYM.SCATTER) n++;
  return n;
}

function findClusters(grid: number[][]): { sym: number; pos: [number, number][] }[] {
  const vis = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
  const out: { sym: number; pos: [number, number][] }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const s = grid[r][c];
      if (vis[r][c] || s === SYM.SCATTER || s === SYM.MULT || s < 0) continue;
      const q: [number, number][] = [[r, c]];
      const pos: [number, number][] = [];
      vis[r][c] = true;
      while (q.length) {
        const [cr, cc] = q.shift()!;
        pos.push([cr, cc]);
        const dirs: [number, number][] = [[cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]];
        for (const [nr, nc] of dirs) {
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !vis[nr][nc] && grid[nr][nc] === s) {
            vis[nr][nc] = true;
            q.push([nr, nc]);
          }
        }
      }
      if (pos.length >= MIN_CLUSTER) out.push({ sym: s, pos });
    }
  }
  return out;
}

function findMults(grid: number[][]): { pos: [number, number]; val: number }[] {
  const out: { pos: [number, number]; val: number }[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c] === SYM.MULT)
        out.push({ pos: [r, c], val: MULT_VALUES[Math.floor(Math.random() * MULT_VALUES.length)] });
  return out;
}

function removeAndTumble(grid: number[][], positions: [number, number][], isFS: boolean): number[][] {
  const g = grid.map(r => [...r]);
  for (const [r, c] of positions) g[r][c] = -1;
  const out = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  for (let c = 0; c < COLS; c++) {
    let wr = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--)
      if (g[r][c] !== -1) { out[wr][c] = g[r][c]; wr--; }
    for (let r = wr; r >= 0; r--) out[r][c] = genSym(isFS);
  }
  return out;
}

function clusterPay(sym: number, count: number, bet: number): number {
  const p = PAY[sym];
  if (!p) return 0;
  return p[Math.min(count - MIN_CLUSTER, 4)] * bet;
}

export interface MultPos { pos: [number, number]; val: number }
export interface SymWin { sym: number; count: number; win: number }
export interface CascadeStep {
  grid: number[][];
  winPos: [number, number][];
  multPos: MultPos[];
  symbolWins: SymWin[];
  rawWin: number;
  appliedMult: number;
  cascadeWin: number;
}

function runSpinSequence(initialGrid: number[][], bet: number, isFS: boolean) {
  let grid = initialGrid;
  const steps: CascadeStep[] = [];
  let totalWin = 0;
  let accMult: number[] = [];

  while (true) {
    const clusters = findClusters(grid);
    if (clusters.length === 0) break;

    const mults = isFS ? findMults(grid) : [];
    for (const m of mults) accMult.push(m.val);

    const multFactor = isFS && accMult.length > 0 ? accMult.reduce((a, b) => a + b, 0) : 1;

    let rawWin = 0;
    const winPos: [number, number][] = [];
    const symbolWins: SymWin[] = [];

    for (const cl of clusters) {
      const w = clusterPay(cl.sym, cl.pos.length, bet);
      rawWin += w;
      winPos.push(...cl.pos);
      symbolWins.push({ sym: cl.sym, count: cl.pos.length, win: w });
    }

    const cascadeWin = parseFloat((rawWin * multFactor).toFixed(4));
    totalWin += cascadeWin;

    steps.push({
      grid: grid.map(r => [...r]),
      winPos,
      multPos: mults,
      symbolWins,
      rawWin: parseFloat(rawWin.toFixed(4)),
      appliedMult: multFactor,
      cascadeWin,
    });

    const removeAll: [number, number][] = [...winPos, ...mults.map(m => m.pos)];
    grid = removeAndTumble(grid, removeAll, isFS);
  }

  return { steps, totalWin: parseFloat(totalWin.toFixed(4)), finalGrid: grid, accMult };
}

router.post("/games/sweet-bonanza/spin", requireAuth, async (req: any, res) => {
  try {
    const { betAmount, isBonusBuy = false } = req.body;
    if (!betAmount || betAmount <= 0)
      return res.status(400).json({ error: "Invalid bet amount" });

    const cost = isBonusBuy ? betAmount * 100 : betAmount;
    const user = req.user;

    if (user.balance < cost)
      return res.status(400).json({ error: "Insufficient balance" });

    await db.update(usersTable)
      .set({ balance: sql`${usersTable.balance} - ${cost}` })
      .where(eq(usersTable.id, user.id));

    const baseGrid = genGrid(false);
    const { steps: baseSteps, totalWin: baseWin, finalGrid: baseFinalGrid } = runSpinSequence(baseGrid, betAmount, false);

    const scatterCount = countScatters(baseGrid);
    let freeSpinsCount = 0;
    if (isBonusBuy || scatterCount >= 4) {
      freeSpinsCount = scatterCount >= 6 ? 15 : scatterCount === 5 ? 12 : 10;
      if (isBonusBuy) freeSpinsCount = 10;
    }

    const fsResults: { grid: number[][]; steps: CascadeStep[]; finalGrid: number[][]; spinWin: number; accMult: number[] }[] = [];
    let fsTotalWin = 0;

    for (let i = 0; i < freeSpinsCount; i++) {
      const fsGrid = genGrid(true);
      const { steps, totalWin: spinWin, finalGrid, accMult } = runSpinSequence(fsGrid, betAmount, true);
      fsTotalWin += spinWin;
      fsResults.push({ grid: fsGrid, steps, finalGrid, spinWin, accMult });
    }

    const totalWin = parseFloat((baseWin + fsTotalWin).toFixed(4));

    if (totalWin > 0) {
      await db.update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${totalWin}` })
        .where(eq(usersTable.id, user.id));
    }

    const newTotalWagered = user.totalWagered + betAmount;
    await db.update(usersTable)
      .set({ totalWagered: newTotalWagered, level: getLevelForWagered(newTotalWagered) })
      .where(eq(usersTable.id, user.id));

    await db.insert(gameBetsTable).values({
      userId: user.id,
      username: user.username,
      game: "sweet-bonanza",
      amount: cost,
      profit: parseFloat((totalWin - cost).toFixed(4)),
      multiplier: cost > 0 ? parseFloat((totalWin / cost).toFixed(2)) : 0,
      detail: isBonusBuy ? "Bonus Buy" : freeSpinsCount > 0 ? `${freeSpinsCount} Free Spins` : "Base Game",
    });

    const [updatedUser] = await db
      .select({ balance: usersTable.balance })
      .from(usersTable)
      .where(eq(usersTable.id, user.id));

    return res.json({
      baseGrid,
      baseSteps,
      baseFinalGrid,
      scatterCount,
      freeSpinsCount,
      fsResults,
      totalWin,
      newBalance: updatedUser.balance,
    });
  } catch (err: any) {
    req.log?.error?.(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
