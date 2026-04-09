import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyToken } from "./auth";

const router: IRouter = Router();

// userId (string) -> set of active Response objects for that user
const userClients = new Map<string, Set<any>>();
// All connected SSE responses (for broadcast)
const allClients = new Set<any>();

export function sendToUser(userId: string | number, eventName: string, data: unknown) {
  const key = String(userId);
  const conns = userClients.get(key);
  if (!conns) return;
  const msg = `data: ${JSON.stringify({ event: eventName, payload: data })}\n\n`;
  for (const res of conns) {
    try { res.write(msg); } catch {}
  }
}

export function broadcast(eventName: string, data: unknown) {
  const msg = `data: ${JSON.stringify({ event: eventName, payload: data })}\n\n`;
  for (const res of allClients) {
    try { res.write(msg); } catch {}
  }
}

router.get("/sse", async (req: any, res: any) => {
  const token = req.query.token as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const [userRow] = await db.select({ id: usersTable.id })
    .from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
  if (!userRow) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`data: ${JSON.stringify({ event: "connected" })}\n\n`);

  const userId = String(userRow.id);
  if (!userClients.has(userId)) userClients.set(userId, new Set());
  userClients.get(userId)!.add(res);
  allClients.add(res);

  // Keep-alive ping every 25 s
  const heartbeat = setInterval(() => {
    try { res.write(": ping\n\n"); } catch {}
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    userClients.get(userId)?.delete(res);
    if (userClients.get(userId)?.size === 0) userClients.delete(userId);
    allClients.delete(res);
  });
});

export default router;
