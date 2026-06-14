import { pgTable, serial, text, integer, boolean, timestamp, jsonb, bigint, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reviewEmailQueue = pgTable("review_email_queue", {
  id: serial("id").primaryKey(),
  shopifyOrderId: bigint("shopify_order_id", { mode: "number" }).notNull().unique(),
  shopifyOrderNumber: integer("shopify_order_number"),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull(),
  products: jsonb("products").$type<Array<{ name: string; slug: string; id: string }>>().notNull(),
  emailSent: boolean("email_sent").notNull().default(false),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_review_email_queue_unsent").on(table.emailSent, table.deliveredAt),
]);

export const insertReviewEmailQueueSchema = createInsertSchema(reviewEmailQueue).omit({
  id: true,
  createdAt: true,
});

export type InsertReviewEmailQueue = z.infer<typeof insertReviewEmailQueueSchema>;
export type ReviewEmailQueue = typeof reviewEmailQueue.$inferSelect;
