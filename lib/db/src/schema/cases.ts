import { pgTable, text, serial, real, jsonb, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const casesTable = pgTable("cases", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  price: real("price").notNull(),
  category: text("category").notNull().default("standard"),
  items: jsonb("items").notNull().$type<CaseItem[]>(),
  isCommunity: boolean("is_community").notNull().default(false),
  createdById: integer("created_by_id"),
  createdByName: text("created_by_name"),
});

export interface CaseItem {
  id: string;
  name: string;
  imageUrl: string;
  rarity: string;
  value: number;
  chance: number;
  color: string;
}

export const caseOpeningsTable = pgTable("case_openings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  caseId: integer("case_id").notNull(),
  itemId: text("item_id").notNull(),
  itemName: text("item_name").notNull(),
  itemValue: real("item_value").notNull(),
  itemRarity: text("item_rarity").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Case = typeof casesTable.$inferSelect;
