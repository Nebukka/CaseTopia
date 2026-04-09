import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  growId: text("grow_id").notNull(),
  type: text("type").notNull(), // "deposit" | "withdrawal"
  amountDl: real("amount_dl").notNull(),
  status: text("status").notNull().default("pending"), // "pending" | "completed" | "failed"
  worldName: text("world_name"),
  botGrowId: text("bot_grow_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});
