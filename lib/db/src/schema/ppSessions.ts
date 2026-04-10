import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const ppSessionsTable = pgTable("pp_sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  gameSymbol: text("game_symbol").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ppRoundsTable = pgTable("pp_rounds", {
  id: serial("id").primaryKey(),
  roundId: text("round_id").notNull().unique(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  gameSymbol: text("game_symbol").notNull(),
  betAmount: text("bet_amount").notNull().default("0"),
  betReference: text("bet_reference"),
  winAmount: text("win_amount").notNull().default("0"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
