import { pgTable, text, serial, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  balance: real("balance").notNull().default(1000),
  avatar: text("avatar"),
  level: integer("level").notNull().default(1),
  totalWagered: real("total_wagered").notNull().default(0),
  allTimeLow: real("all_time_low"),
  allTimeHigh: real("all_time_high"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  mutedUntil: timestamp("muted_until"),
  lastDailyClaim: timestamp("last_daily_claim"),
  lastMonthlyRakeback: timestamp("last_monthly_rakeback"),
  totalRakebackClaimed: real("total_rakeback_claimed").notNull().default(0),
  rakebackBalance: real("rakeback_balance").notNull().default(0),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
