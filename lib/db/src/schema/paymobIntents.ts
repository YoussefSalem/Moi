import { pgTable, serial, bigint, integer, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymobIntents = pgTable("paymob_intents", {
  id: serial("id").primaryKey(),
  intentId: text("intent_id").notNull(),
  lines: jsonb("lines").notNull(),
  customer: jsonb("customer").notNull(),
  cartId: text("cart_id"),
  discountCode: text("discount_code"),
  amountCents: integer("amount_cents").notNull(),
  total: text("total").notNull(),
  status: text("status").notNull().default("pending"),
  shopifyOrderId: bigint("shopify_order_id", { mode: "number" }),
  shopifyConfirmedOrderId: bigint("shopify_confirmed_order_id", { mode: "number" }),
  shopifyOrderNumber: integer("shopify_order_number"),
  paymobTxnId: text("paymob_txn_id"),
  attribution: jsonb("attribution"),
  checkoutToken: text("checkout_token"),
  adminApproved: boolean("admin_approved").notNull().default(false),
  adminApprovedAt: timestamp("admin_approved_at"),
  bostaDispatched: boolean("bosta_dispatched").notNull().default(false),
  bostaTrackingNumber: text("bosta_tracking_number"),
  bostaDispatchedAt: timestamp("bosta_dispatched_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPaymobIntentSchema = createInsertSchema(paymobIntents).omit({
  id: true,
  createdAt: true,
});

export type InsertPaymobIntent = z.infer<typeof insertPaymobIntentSchema>;
export type PaymobIntent = typeof paymobIntents.$inferSelect;
