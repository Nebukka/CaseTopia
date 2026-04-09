import { Router, type IRouter } from "express";
import { db, usersTable, gameBetsTable, tierClaimsTable, casesTable, caseOpeningsTable } from "@workspace/db";
import type { CaseItem } from "@workspace/db";
import { eq, sql, and, gte } from "drizzle-orm";
import { requireAuth } from "./auth";
import {
  getLevelForWagered,
  getProgressPercent,
  TIERS,
  getUnlockedTiers,
  getRakebackTier,
  getNextRakebackTier,
  canClaimMonthlyRakeback,
  LEVEL_THRESHOLDS,
} from "../lib/levels";

const router: IRouter = Router();

function startOfToday(): Date {
  // Daily cases reset at 12:00 UTC+3 = 09:00 UTC
  const RESET_HOUR_UTC = 9;
  const now = new Date();
  const d = new Date(now);
  d.setUTCHours(RESET_HOUR_UTC, 0, 0, 0);
  // If we haven't reached today's reset yet, use yesterday's reset window
  if (now < d) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

// ── Rewards status (level + tiers + monthly) ──────────────────────────────────
router.get("/daily/status", requireAuth, async (req: any, res) => {
  try {
    const user = req.user;
    const level = user.level ?? 1;
    const progress = getProgressPercent(user.totalWagered ?? 0, level);
    const nextThreshold = level < 150 ? LEVEL_THRESHOLDS[level + 1] : null;

    // Which tiers claimed today?
    const claimedToday = await db
      .select({ tier: tierClaimsTable.tier })
      .from(tierClaimsTable)
      .where(
        and(
          eq(tierClaimsTable.userId, user.id),
          gte(tierClaimsTable.claimedAt, startOfToday())
        )
      );
    const claimedTierNums = new Set(claimedToday.map((c) => c.tier));

    // Monthly rakeback — tiered by wagered volume, applied to net losses
    const monthlyBets = await db
      .select({ profit: gameBetsTable.profit, amount: gameBetsTable.amount })
      .from(gameBetsTable)
      .where(
        and(
          eq(gameBetsTable.userId, user.id),
          gte(gameBetsTable.createdAt, startOfMonth())
        )
      );
    const monthlyWagered = monthlyBets.reduce((sum, b) => sum + b.amount, 0);
    const monthlyNetLoss = Math.max(
      0,
      monthlyBets.reduce((sum, b) => sum - b.profit, 0)
    );
    const currentTier = getRakebackTier(monthlyWagered);
    const nextTier = getNextRakebackTier(monthlyWagered);
    const rakebackAmount = parseFloat((monthlyNetLoss * currentTier.percent / 100).toFixed(2));
    const canClaimRakeback = canClaimMonthlyRakeback(user.lastMonthlyRakeback);

    // Look up daily case IDs by name so linkedCaseId is always accurate
    const dailyCaseRows = await db
      .select({ id: casesTable.id, name: casesTable.name })
      .from(casesTable)
      .where(eq(casesTable.category, "daily"));
    const dailyCaseIdByName = new Map(dailyCaseRows.map((c) => [c.name, c.id]));

    const tiers = TIERS.map((t) => ({
      ...t,
      unlocked: level >= t.requiredLevel,
      claimed: claimedTierNums.has(t.tier),
      linkedCaseId: t.linkedCaseName ? dailyCaseIdByName.get(t.linkedCaseName) : undefined,
    }));

    res.json({
      level,
      progress,
      totalWagered: user.totalWagered ?? 0,
      nextThreshold,
      tiers,
      rakebackBalance: parseFloat((user.rakebackBalance ?? 0).toFixed(4)),
      totalRakebackClaimed: user.totalRakebackClaimed ?? 0,
      monthly: {
        monthlyWagered,
        monthlyNetLoss,
        currentTier,
        nextTier,
        rakebackAmount,
        canClaim: canClaimRakeback && rakebackAmount > 0,
        totalRakebackClaimed: user.totalRakebackClaimed ?? 0,
      },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Claim a single tier case ─────────────────────────────────────────────────
router.post("/daily/claim-tier", requireAuth, async (req: any, res) => {
  try {
    const { tier: tierNum } = req.body ?? {};
    if (!tierNum) {
      res.status(400).json({ error: "tier required" });
      return;
    }
    const tier = TIERS.find((t) => t.tier === tierNum);
    if (!tier) {
      res.status(400).json({ error: "Invalid tier" });
      return;
    }
    if (tier.linkedCaseId) {
      res.status(400).json({ error: "This tier must be opened via the case spinner" });
      return;
    }
    const user = req.user;
    if ((user.level ?? 1) < tier.requiredLevel) {
      res.status(403).json({ error: `Requires Level ${tier.requiredLevel}` });
      return;
    }

    // Check already claimed today
    const already = await db
      .select({ id: tierClaimsTable.id })
      .from(tierClaimsTable)
      .where(
        and(
          eq(tierClaimsTable.userId, user.id),
          eq(tierClaimsTable.tier, tierNum),
          gte(tierClaimsTable.claimedAt, startOfToday())
        )
      )
      .limit(1);

    if (already.length) {
      res.status(429).json({ error: "Already claimed this tier today" });
      return;
    }

    const reward = parseFloat(
      (tier.dailyMin + Math.random() * (tier.dailyMax - tier.dailyMin)).toFixed(2)
    );

    const [updated] = await db.transaction(async (tx) => {
      await tx.insert(tierClaimsTable).values({
        userId: user.id,
        tier: tierNum,
        reward,
      });
      return tx
        .update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${reward}` })
        .where(eq(usersTable.id, user.id))
        .returning({ balance: usersTable.balance });
    });

    res.json({ reward, newBalance: updated.balance, tier: tierNum });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Open a linked case for a tier (free daily spin) ──────────────────────────
router.post("/daily/open-tier-case", requireAuth, async (req: any, res) => {
  try {
    const { tier: tierNum } = req.body ?? {};
    if (!tierNum) { res.status(400).json({ error: "tier required" }); return; }

    const tier = TIERS.find((t) => t.tier === tierNum);
    if (!tier || !tier.linkedCaseName) {
      res.status(400).json({ error: "This tier has no linked case" });
      return;
    }

    const user = req.user;
    if ((user.level ?? 1) < tier.requiredLevel) {
      res.status(403).json({ error: `Requires Level ${tier.requiredLevel}` });
      return;
    }

    // Check already claimed today
    const already = await db
      .select({ id: tierClaimsTable.id })
      .from(tierClaimsTable)
      .where(and(
        eq(tierClaimsTable.userId, user.id),
        eq(tierClaimsTable.tier, tierNum),
        gte(tierClaimsTable.claimedAt, startOfToday())
      ))
      .limit(1);
    if (already.length) { res.status(429).json({ error: "Already claimed this tier today" }); return; }

    // Fetch the linked case by name
    const cases = await db.select().from(casesTable).where(
      and(eq(casesTable.name, tier.linkedCaseName), eq(casesTable.category, "daily"))
    ).limit(1);
    if (!cases.length) { res.status(404).json({ error: "Linked case not found" }); return; }

    const c = cases[0];
    const items = c.items as CaseItem[];
    if (!items?.length) { res.status(400).json({ error: "Case has no items" }); return; }

    // Roll item
    const total = items.reduce((s, i) => s + i.chance, 0);
    let rand = Math.random() * total;
    let wonItem = items[items.length - 1];
    for (const item of items) {
      rand -= item.chance;
      if (rand <= 0) { wonItem = item; break; }
    }

    // Transaction: add item value to balance, record claim & opening
    const [updated] = await db.transaction(async (tx) => {
      await tx.insert(tierClaimsTable).values({ userId: user.id, tier: tierNum, reward: wonItem.value });
      await tx.insert(caseOpeningsTable).values({
        userId: user.id, caseId: c.id, itemId: wonItem.id,
        itemName: wonItem.name, itemValue: wonItem.value, itemRarity: wonItem.rarity,
      });
      await tx.insert(gameBetsTable).values({
        userId: user.id, username: user.username, game: "cases",
        amount: 0, profit: wonItem.value, detail: `Daily Tier ${tierNum}: Won ${wonItem.name}`,
      });
      return tx.update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${wonItem.value}` })
        .where(eq(usersTable.id, user.id))
        .returning({ balance: usersTable.balance });
    });

    res.json({ item: wonItem, newBalance: updated.balance, tier: tierNum });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Claim ALL available tier cases ───────────────────────────────────────────
router.post("/daily/claim-all", requireAuth, async (req: any, res) => {
  try {
    const user = req.user;
    const level = user.level ?? 1;
    const unlocked = TIERS.filter((t) => level >= t.requiredLevel);

    const claimedToday = await db
      .select({ tier: tierClaimsTable.tier })
      .from(tierClaimsTable)
      .where(
        and(
          eq(tierClaimsTable.userId, user.id),
          gte(tierClaimsTable.claimedAt, startOfToday())
        )
      );
    const claimedSet = new Set(claimedToday.map((c) => c.tier));
    // Skip tiers with linked cases — those require the case spinner to claim
    const toClaimTiers = unlocked.filter((t) => !claimedSet.has(t.tier) && !t.linkedCaseId);

    if (!toClaimTiers.length) {
      res.status(429).json({ error: "All available cases already claimed today" });
      return;
    }

    const claims = toClaimTiers.map((t) => ({
      tier: t.tier,
      reward: parseFloat(
        (t.dailyMin + Math.random() * (t.dailyMax - t.dailyMin)).toFixed(2)
      ),
    }));
    const totalReward = claims.reduce((s, c) => s + c.reward, 0);

    const [updated] = await db.transaction(async (tx) => {
      await tx.insert(tierClaimsTable).values(
        claims.map((c) => ({ userId: user.id, tier: c.tier, reward: c.reward }))
      );
      return tx
        .update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${totalReward}` })
        .where(eq(usersTable.id, user.id))
        .returning({ balance: usersTable.balance });
    });

    res.json({ claims, totalReward, newBalance: updated.balance });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Claim instant per-bet rakeback ──────────────────────────────────────────
router.post("/rakeback/claim", requireAuth, async (req: any, res) => {
  try {
    const user = req.user;
    const available = parseFloat((user.rakebackBalance ?? 0).toFixed(4));

    if (available <= 0) {
      res.status(400).json({ error: "No rakeback balance to claim" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({
        balance: sql`${usersTable.balance} + ${available}`,
        rakebackBalance: 0,
        totalRakebackClaimed: sql`${usersTable.totalRakebackClaimed} + ${available}`,
      })
      .where(eq(usersTable.id, user.id))
      .returning({ balance: usersTable.balance, totalRakebackClaimed: usersTable.totalRakebackClaimed });

    res.json({ amount: available, newBalance: updated.balance, totalRakebackClaimed: updated.totalRakebackClaimed });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Claim monthly rakeback ───────────────────────────────────────────────────
router.post("/daily/claim-monthly", requireAuth, async (req: any, res) => {
  try {
    const user = req.user;

    if (!canClaimMonthlyRakeback(user.lastMonthlyRakeback)) {
      res.status(429).json({ error: "Already claimed this month's rakeback" });
      return;
    }

    const monthlyBets = await db
      .select({ profit: gameBetsTable.profit, amount: gameBetsTable.amount })
      .from(gameBetsTable)
      .where(
        and(
          eq(gameBetsTable.userId, user.id),
          gte(gameBetsTable.createdAt, startOfMonth())
        )
      );
    const monthlyWagered = monthlyBets.reduce((sum, b) => sum + b.amount, 0);
    const monthlyNetLoss = Math.max(0, monthlyBets.reduce((sum, b) => sum - b.profit, 0));
    const tier = getRakebackTier(monthlyWagered);
    const amount = parseFloat((monthlyNetLoss * tier.percent / 100).toFixed(2));

    if (amount <= 0) {
      res.status(400).json({ error: "No rakeback available — wager more or have net losses this month" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({
        balance: sql`${usersTable.balance} + ${amount}`,
        lastMonthlyRakeback: new Date(),
        totalRakebackClaimed: sql`${usersTable.totalRakebackClaimed} + ${amount}`,
      })
      .where(eq(usersTable.id, user.id))
      .returning({ balance: usersTable.balance, totalRakebackClaimed: usersTable.totalRakebackClaimed });

    res.json({ amount, percent: tier.percent, tierLabel: tier.label, newBalance: updated.balance });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/reset-daily/:userId", requireAuth, async (req, res) => {
  const admin = (req as any).user;
  if (admin.id !== 1) return res.status(403).json({ error: "Forbidden" });
  const targetId = parseInt(req.params.userId, 10);
  if (isNaN(targetId)) return res.status(400).json({ error: "Invalid userId" });
  await db.delete(tierClaimsTable).where(eq(tierClaimsTable.userId, targetId));
  res.json({ ok: true, message: `Reset daily claims for user ${targetId}` });
});

export default router;
