import { Router, type IRouter } from "express";

const router: IRouter = Router();

// In-memory map: sessionId -> last seen timestamp (ms)
const sessions = new Map<string, number>();

const STALE_MS = 2 * 60 * 1000; // 2 minutes

function purgeStale() {
  const cutoff = Date.now() - STALE_MS;
  for (const [id, ts] of sessions) {
    if (ts < cutoff) sessions.delete(id);
  }
}

// Purge stale sessions every 60 seconds
setInterval(purgeStale, 60_000);

// POST /api/presence/heartbeat
// Body: { sessionId: string }
// No auth required — works for both logged-in and anonymous users
router.post("/presence/heartbeat", (req: any, res) => {
  const sessionId: string | undefined = req.body?.sessionId;
  if (!sessionId || typeof sessionId !== "string" || sessionId.length > 128) {
    res.status(400).json({ error: "Invalid sessionId" });
    return;
  }
  sessions.set(sessionId, Date.now());
  purgeStale();
  res.json({ count: sessions.size });
});

// GET /api/presence/count
router.get("/presence/count", (_req, res) => {
  purgeStale();
  res.json({ count: sessions.size });
});

export default router;
