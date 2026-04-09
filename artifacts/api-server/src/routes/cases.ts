import { Router, type IRouter } from "express";
import { db, casesTable, caseOpeningsTable, usersTable, gameBetsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "./auth";
import type { CaseItem } from "@workspace/db";
import { getLevelForWagered, getInstantRakebackPercent, HOUSE_EDGE } from "../lib/levels";

const router: IRouter = Router();

const DEFAULT_CASE_NAMES = ["Starter Case", "Rare Finds", "Legendary Box", "Diamond Case", "Celestial Crate"];

async function removeDefaultCases() {
  for (const name of DEFAULT_CASE_NAMES) {
    await db.delete(casesTable).where(eq(casesTable.name, name as any));
  }
}

removeDefaultCases().catch(console.error);

function formatCase(c: any) {
  return {
    id: String(c.id),
    name: c.name,
    imageUrl: c.imageUrl,
    price: c.price,
    category: c.category,
    isCommunity: c.isCommunity ?? false,
    createdById: c.createdById ?? null,
    createdByName: c.createdByName ?? null,
    items: (c.items as CaseItem[]).map((item) => ({
      ...item,
      imageUrl: item.imageUrl || "",
    })),
  };
}

// One-time forced rarest-item override per case (dev tool)
const forceRarestOnce = new Set<number>();

function rollItem(items: CaseItem[], caseId?: number): CaseItem {
  if (caseId !== undefined && forceRarestOnce.has(caseId)) {
    forceRarestOnce.delete(caseId);
    return items.reduce((min, item) => item.chance < min.chance ? item : min, items[0]);
  }
  const total = items.reduce((s, i) => s + i.chance, 0);
  const rand = Math.random() * total;
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.chance;
    if (rand < cumulative) return item;
  }
  return items[items.length - 1];
}

router.post("/cases/:id/force-next-rarest", requireAuth, async (req: any, res) => {
  const caseId = parseInt(req.params.id);
  forceRarestOnce.add(caseId);
  res.json({ ok: true, caseId });
});

router.get("/cases", async (_req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const cases = await db.select().from(casesTable);
    const openCounts = await db
      .select({ caseId: caseOpeningsTable.caseId, count: sql<number>`count(*)::int` })
      .from(caseOpeningsTable)
      .groupBy(caseOpeningsTable.caseId);
    const openCountMap = new Map(openCounts.map((r) => [r.caseId, r.count]));
    // Exclude "daily" category cases from the public listing
    res.json(cases.filter((c) => c.category !== "daily").map((c) => ({ ...formatCase(c), openCount: openCountMap.get(c.id) ?? 0 })));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/cases/:id", async (req, res) => {
  try {
    const cases = await db.select().from(casesTable).where(eq(casesTable.id, parseInt(req.params.id))).limit(1);
    if (!cases.length) {
      res.status(404).json({ error: "Case not found" });
      return;
    }
    res.json(formatCase(cases[0]));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/cases/:id/open", requireAuth, async (req: any, res) => {
  try {
    const caseId = parseInt(req.params.id);
    const count = Math.min(4, Math.max(1, parseInt(req.body?.count) || 1));

    const cases = await db.select().from(casesTable).where(eq(casesTable.id, caseId)).limit(1);
    if (!cases.length) {
      res.status(404).json({ error: "Case not found" });
      return;
    }
    const c = cases[0];
    if (req.user.balance < c.price * count) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }

    const items = c.items as CaseItem[];
    // Roll all items before entering the transaction (CPU only, no DB)
    const wonItems: CaseItem[] = Array.from({ length: count }, () => rollItem(items, caseId));
    const totalCost = c.price * count;
    const totalWinnings = wonItems.reduce((s, i) => s + i.value, 0);

    // Single transaction: one balance update + batch inserts
    const rakebackPct = getInstantRakebackPercent(req.user.level ?? 1);
    const caseEdge = HOUSE_EDGE["cases"] ?? 6;
    const rakebackAmount = parseFloat((totalCost * caseEdge / 100 * rakebackPct / 100).toFixed(4));

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(usersTable)
        .set({
          balance: sql`${usersTable.balance} - ${totalCost} + ${totalWinnings}`,
          totalWagered: sql`${usersTable.totalWagered} + ${totalCost}`,
          level: getLevelForWagered(req.user.totalWagered + totalCost),
          rakebackBalance: sql`${usersTable.rakebackBalance} + ${rakebackAmount}`,
        })
        .where(eq(usersTable.id, req.user.id))
        .returning({ balance: usersTable.balance });

      await tx.insert(caseOpeningsTable).values(
        wonItems.map((wonItem) => ({
          userId: req.user.id,
          caseId,
          itemId: wonItem.id,
          itemName: wonItem.name,
          itemValue: wonItem.value,
          itemRarity: wonItem.rarity,
        }))
      );

      await tx.insert(gameBetsTable).values(
        wonItems.map((wonItem) => ({
          userId: req.user.id,
          username: req.user.username,
          game: "cases",
          amount: c.price,
          profit: wonItem.value - c.price,
          detail: `Won ${wonItem.name} from ${c.name}`,
        }))
      );

      return updated.balance;
    });

    res.json({ items: wonItems, newBalance: result });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/cases/:id", requireAuth, async (req: any, res) => {
  try {
    const caseId = parseInt(req.params.id);
    const cases = await db.select().from(casesTable).where(eq(casesTable.id, caseId)).limit(1);
    if (!cases.length) { res.status(404).json({ error: "Case not found" }); return; }
    const c = cases[0];
    if (!c.isCommunity) { res.status(403).json({ error: "Cannot delete official cases" }); return; }
    if (c.createdById !== req.user.id) { res.status(403).json({ error: "Not your case" }); return; }
    await db.delete(casesTable).where(eq(casesTable.id, caseId));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/cases", requireAuth, async (req: any, res) => {
  try {
    const { name, items, imageUrl } = req.body as { name: string; items: CaseItem[]; imageUrl?: string };

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({ error: "Case name must be at least 2 characters" });
      return;
    }
    if (!Array.isArray(items) || items.length < 2) {
      res.status(400).json({ error: "A case must have at least 2 items" });
      return;
    }
    const totalChance = items.reduce((s, i) => s + (i.chance ?? 0), 0);
    if (Math.abs(totalChance - 100) > 0.0001) {
      res.status(400).json({ error: `Drop rates must sum to exactly 100% (got ${totalChance.toFixed(4)}%)` });
      return;
    }

    // Price = EV / 0.94  →  6% house edge
    const expectedValue = items.reduce((s, i) => s + i.value * (i.chance / 100), 0);
    const price = parseFloat((expectedValue / 0.94).toFixed(4));

    const [created] = await db.insert(casesTable).values({
      name: name.trim(),
      imageUrl: imageUrl ?? "",
      price,
      category: "community",
      items,
      isCommunity: true,
      createdById: req.user.id,
      createdByName: req.user.username,
    }).returning();

    res.status(201).json(formatCase(created));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
