import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const abandonedCarts = pgTable("abandoned_carts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  cartId: text("cart_id"),
  lineItems: jsonb("line_items").notNull(),
  /** Original Shopify cart ID for reference (may be expired) */
  originalCartId: text("original_cart_id"),
  totalAmount: text("total_amount").notNull(),
  status: text("status").notNull().default("started"),
  /** Unique token for the recovery link (e.g. ?recover-cart=abc123) */
  recoveryToken: text("recovery_token").notNull().unique(),
  emailSentAt: timestamp("email_sent_at"),
  clickedAt: timestamp("clicked_at"),
  recoveredAt: timestamp("recovered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAbandonedCartSchema = createInsertSchema(abandonedCarts).omit({
  id: true,
  emailSentAt: true,
  clickedAt: true,
  recoveredAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAbandonedCart = z.infer<typeof insertAbandonedCartSchema>;
export type AbandonedCart = typeof abandonedCarts.$inferSelect;
