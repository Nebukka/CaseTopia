import { pgTable, text, serial, real, jsonb, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const battlesTable = pgTable("battles", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("waiting"),
  caseIds: jsonb("case_ids").notNull().$type<number[]>(),
  players: jsonb("players").notNull().$type<BattlePlayer[]>().default([]),
  maxPlayers: integer("max_players").notNull().default(2),
  totalValue: real("total_value").notNull().default(0),
  winnerId: integer("winner_id"),
  winnerTeamIndex: integer("winner_team_index"),
  gameMode: text("game_mode").notNull().default("1v1"),
  isShared: boolean("is_shared").notNull().default(false),
  battleType: text("battle_type").notNull().default("normal"),
  rounds: jsonb("rounds").notNull().$type<BattleRound[]>().default([]),
  isDraw: boolean("is_draw").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export interface BattlePlayer {
  userId: number;
  username: string;
  avatar?: string;
  items: BattleItem[];
  totalValue: number;
  teamIndex: number;
  slotIndex: number;
}

export interface BattleItem {
  id: string;
  name: string;
  imageUrl: string;
  rarity: string;
  value: number;
  color: string;
}

export interface BattleRound {
  roundNumber: number;
  caseId: number;
  results: { userId: number; item: BattleItem }[];
}

export type Battle = typeof battlesTable.$inferSelect;
