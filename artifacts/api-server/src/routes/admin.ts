import { Router, type IRouter } from "express";
import { db, providerGamesTable, importJobsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "./auth";
import { runImportJob } from "../services/gameImporter";

const router: IRouter = Router();

const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || "Cylax").split(",").map(u => u.trim().toLowerCase());

function requireAdmin(req: any, res: any, next: any) {
  const user = req.user;
  if (!user || !ADMIN_USERNAMES.includes(user.username.toLowerCase())) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

// ── Trigger import ────────────────────────────────────────────────────────────
router.post("/api/admin/import/run", requireAuth, requireAdmin, async (req: any, res) => {
  const provider = req.body?.provider || "pragmaticplay";
  try {
    const result = await runImportJob(provider);
    res.json({ ok: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Import job history ────────────────────────────────────────────────────────
router.get("/api/admin/import/jobs", requireAuth, requireAdmin, async (req: any, res) => {
  const jobs = await db
    .select()
    .from(importJobsTable)
    .orderBy(desc(importJobsTable.startedAt))
    .limit(20);
  res.json(jobs);
});

// ── Game list ─────────────────────────────────────────────────────────────────
router.get("/api/admin/games", requireAuth, requireAdmin, async (req: any, res) => {
  const provider = req.query.provider as string | undefined;
  const games = await db
    .select()
    .from(providerGamesTable)
    .where(provider ? eq(providerGamesTable.provider, provider) : undefined)
    .orderBy(providerGamesTable.provider, providerGamesTable.name);
  res.json(games);
});

// ── Public: game list for frontend (active only) ──────────────────────────────
router.get("/api/games/catalog", async (req, res) => {
  const provider = req.query.provider as string | undefined;
  const games = await db
    .select()
    .from(providerGamesTable)
    .where(
      and(
        eq(providerGamesTable.active, true),
        provider ? eq(providerGamesTable.provider, provider) : undefined
      )
    )
    .orderBy(providerGamesTable.provider, providerGamesTable.name);
  res.json(games);
});

// ── Toggle game active/inactive ───────────────────────────────────────────────
router.patch("/api/admin/games/:id", requireAuth, requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id);
  const { active } = req.body;
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(providerGamesTable).set({ active, updatedAt: new Date() }).where(eq(providerGamesTable.id, id));
  res.json({ ok: true });
});

export default router;
