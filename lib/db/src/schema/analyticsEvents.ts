import { pgTable, serial, text, timestamp, integer, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  visitorId: text("visitor_id").notNull(),
  /** Event category: page | product | cart | checkout | purchase */
  category: varchar("category", { length: 32 }).notNull(),
  /** Event name: e.g. view, scroll, click, add_to_cart, start_checkout, etc */
  event: varchar("event", { length: 64 }).notNull(),
  /** Page URL where event occurred */
  pageUrl: text("page_url"),
  /** Product ID if product-related */
  productId: text("product_id"),
  /** Product title if available */
  productTitle: text("product_title"),
  /** Extra event data (scroll depth, variant color, step name, etc) */
  metadata: jsonb("metadata"),
  /** Time spent on this event/action in seconds */
  timeSpentSeconds: integer("time_spent_seconds"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
