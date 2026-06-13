import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productReviews = pgTable("product_reviews", {
  id: serial("id").primaryKey(),
  productHandle: text("product_handle").notNull(),
  variantId: text("variant_id"),
  author: text("author"),
  email: text("email"),
  title: text("title"),
  body: text("body"),
  rating: integer("rating").notNull(),
  /** pending | approved | rejected | spam */
  status: text("status").notNull().default("pending"),
  spamReason: text("spam_reason"),
  ipAddress: text("ip_address"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const insertProductReviewSchema = createInsertSchema(productReviews).omit({
  id: true,
  submittedAt: true,
  reviewedAt: true,
});

export type InsertProductReview = z.infer<typeof insertProductReviewSchema>;
export type ProductReview = typeof productReviews.$inferSelect;
