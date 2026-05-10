import { pgTable, serial, text, integer, bigint, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymobIntents = pgTable("paymob_intents", {
  id: serial("id").primaryKey(),
  intentId: text("intent_id").notNull().unique(),
  lines: jsonb("lines").notNull(),
  customer: jsonb("customer").notNull(),
  cartId: text("cart_id"),
  discountCode: text("discount_code"),
  amountCents: integer("amount_cents").notNull(),
  total: text("total").notNull(),
  status: text("status").notNull().default("pending"),
  shopifyOrderId: bigint("shopify_order_id", { mode: "number" }),
  paymobTxnId: text("paymob_txn_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPaymobIntentSchema = createInsertSchema(paymobIntents).omit({
  id: true,
  createdAt: true,
});

export type InsertPaymobIntent = z.infer<typeof insertPaymobIntentSchema>;
export type PaymobIntent = typeof paymobIntents.$inferSelect;
