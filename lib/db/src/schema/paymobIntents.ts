import { pgTable, serial, text, integer, bigint, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
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
  /** Shopify draft order ID set by processPaymobSuccess — awaits admin approval */
  shopifyOrderId: bigint("shopify_order_id", { mode: "number" }),
  /** Shopify confirmed (real) order ID — set after admin approves the draft */
  shopifyConfirmedOrderId: bigint("shopify_confirmed_order_id", { mode: "number" }),
  /** Human-readable Shopify order number (e.g. 1081) — stored so it can be displayed without calling Shopify API */
  shopifyOrderNumber: integer("shopify_order_number"),
  paymobTxnId: text("paymob_txn_id"),
  /** Shipping amount in cents for this order (0 = free shipping, 5000 = 50 EGP). Null on legacy intents. */
  shippingCents: integer("shipping_cents"),
  /** Marketing attribution captured from the session (UTM, fbclid, gclid, ttclid) */
  attribution: jsonb("attribution"),
  /** Shopify abandoned-checkout token from /api/checkouts/register — completed when order succeeds */
  checkoutToken: text("checkout_token"),
  /** Whether admin has approved this card order (converted draft → confirmed Shopify order) */
  adminApproved: boolean("admin_approved").notNull().default(false),
  /** Timestamp when admin approved the order */
  adminApprovedAt: timestamp("admin_approved_at"),
  /** Whether a Bosta shipment has been created for this order (set by admin dispatch) */
  bostaDispatched: boolean("bosta_dispatched").notNull().default(false),
  /** Bosta tracking number once dispatched */
  bostaTrackingNumber: text("bosta_tracking_number"),
  /** Timestamp when admin dispatched the order to Bosta */
  bostaDispatchedAt: timestamp("bosta_dispatched_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPaymobIntentSchema = createInsertSchema(paymobIntents).omit({
  id: true,
  createdAt: true,
});

export type InsertPaymobIntent = z.infer<typeof insertPaymobIntentSchema>;
export type PaymobIntent = typeof paymobIntents.$inferSelect;
