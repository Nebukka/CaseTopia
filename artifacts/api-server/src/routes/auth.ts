import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const router: IRouter = Router();

const JWT_SECRET = process.env.SESSION_SECRET || "bettopia-secret-key";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "bettopia_salt").digest("hex");
}

function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number };
  } catch {
    return null;
  }
}

export async function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const users = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
  if (!users.length) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  req.user = users[0];
  next();
}

function formatUser(user: any) {
  return {
    id: String(user.id),
    username: user.username,
    email: user.email,
    balance: user.balance,
    avatar: user.avatar,
    level: user.level,
    totalWagered: user.totalWagered,
    allTimeHigh: user.allTimeHigh ?? null,
    allTimeLow: user.allTimeLow ?? null,
    createdAt: user.createdAt?.toISOString(),
  };
}

router.post("/auth/register", async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password || !email) {
      res.status(400).json({ error: "Username, password, and email are required" });
      return;
    }
    const existing = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (existing.length) {
      res.status(400).json({ error: "Username already taken" });
      return;
    }
    const emailExists = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (emailExists.length) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }
    const passwordHash = hashPassword(password);
    const [user] = await db.insert(usersTable).values({
      username,
      email,
      passwordHash,
      balance: 1000, // Start with 1000 gems
      level: 1,
      totalWagered: 0,
    }).returning();
    const token = generateToken(user.id);
    res.json({ user: formatUser(user), token });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }
    const users = await db.select().from(usersTable).where(eq(sql`LOWER(${usersTable.username})`, username.toLowerCase())).limit(1);
    if (!users.length) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const user = users[0];
    const passwordHash = hashPassword(password);
    if (user.passwordHash !== passwordHash) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = generateToken(user.id);
    res.json({ user: formatUser(user), token });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.json({ message: "Logged out" });
});

router.get("/auth/me", requireAuth, (req: any, res) => {
  res.json(formatUser(req.user));
});

router.patch("/auth/me", requireAuth, async (req: any, res) => {
  try {
    const { avatar } = req.body as { avatar?: string | null };
    if (avatar !== undefined && avatar !== null) {
      if (typeof avatar !== "string" || (!avatar.startsWith("data:image/jpeg") && !avatar.startsWith("data:image/png") && !avatar.startsWith("data:image/webp"))) {
        res.status(400).json({ error: "Avatar must be a JPEG or PNG image" });
        return;
      }
      if (avatar.length > 4_000_000) {
        res.status(400).json({ error: "Image is too large (max ~3MB)" });
        return;
      }
    }
    const [updated] = await db.update(usersTable)
      .set({ avatar: avatar ?? null })
      .where(eq(usersTable.id, req.user.id))
      .returning();
    res.json(formatUser(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
