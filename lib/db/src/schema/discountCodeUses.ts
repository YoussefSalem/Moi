import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const discountCodeUses = pgTable("discount_code_uses", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  orderId: integer("order_id"),
  orderNumber: integer("order_number"),
  paymentMethod: text("payment_method"),
  usedAt: timestamp("used_at").defaultNow().notNull(),
});

export type DiscountCodeUse = typeof discountCodeUses.$inferSelect;
