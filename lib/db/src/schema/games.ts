import { pgTable, text, serial, real, jsonb, integer, timestamp, boolean, unique } from "drizzle-orm/pg-core";

export const crashHistoryTable = pgTable("crash_history", {
  id: serial("id").primaryKey(),
  crashPoint: real("crash_point").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const minesGamesTable = pgTable("mines_games", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: real("amount").notNull(),
  mineCount: integer("mine_count").notNull(),
  minePositions: jsonb("mine_positions").notNull().$type<number[]>(),
  revealed: jsonb("revealed").notNull().$type<number[]>().default([]),
  status: text("status").notNull().default("active"), // active, won, lost
  currentMultiplier: real("current_multiplier").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const gameBetsTable = pgTable("game_bets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  game: text("game").notNull(), // crash, limbo, mines, tower, cases
  amount: real("amount").notNull(),
  profit: real("profit").notNull(),
  multiplier: real("multiplier"),
  detail: text("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const racePayoutsTable = pgTable("race_payouts", {
  id: serial("id").primaryKey(),
  raceStartAt: timestamp("race_start_at").notNull().unique(),
  paidAt: timestamp("paid_at").notNull().defaultNow(),
});

export type CrashHistory = typeof crashHistoryTable.$inferSelect;
export type MinesGame = typeof minesGamesTable.$inferSelect;
export type GameBet = typeof gameBetsTable.$inferSelect;
export type RacePayout = typeof racePayoutsTable.$inferSelect;
