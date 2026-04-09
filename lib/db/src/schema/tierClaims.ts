import { pgTable, serial, integer, real, timestamp } from "drizzle-orm/pg-core";

export const tierClaimsTable = pgTable("tier_claims", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  tier: integer("tier").notNull(),
  reward: real("reward").notNull(),
  claimedAt: timestamp("claimed_at").notNull().defaultNow(),
});
