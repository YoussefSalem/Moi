import { pgTable, serial, text, bigint, timestamp } from "drizzle-orm/pg-core";

export const discountCodeUses = pgTable("discount_code_uses", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  /** Shopify order IDs exceed 32-bit integer range */
  orderId: bigint("order_id", { mode: "number" }),
  orderNumber: bigint("order_number", { mode: "number" }),
  paymentMethod: text("payment_method"),
  usedAt: timestamp("used_at").defaultNow().notNull(),
});

export type DiscountCodeUse = typeof discountCodeUses.$inferSelect;
