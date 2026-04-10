import { pgTable, text, serial, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";

export const providerGamesTable = pgTable("provider_games", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  provider: text("provider").notNull(),
  name: text("name").notNull(),
  gameType: text("game_type").notNull().default("slot"),
  volatility: text("volatility"),
  lines: integer("lines"),
  ways: integer("ways"),
  rtp: real("rtp"),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  demoAvailable: boolean("demo_available").notNull().default(true),
  active: boolean("active").notNull().default(true),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const importJobsTable = pgTable("import_jobs", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  status: text("status").notNull().default("pending"),
  gamesImported: integer("games_imported").notNull().default(0),
  gamesUpdated: integer("games_updated").notNull().default(0),
  error: text("error"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
});

export type ProviderGame = typeof providerGamesTable.$inferSelect;
export type ImportJob = typeof importJobsTable.$inferSelect;
