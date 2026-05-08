import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const restockNotifications = pgTable("restock_notifications", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  productHandle: text("product_handle").notNull(),
  variantId: text("variant_id").notNull(),
  variantTitle: text("variant_title").notNull().default(""),
  productTitle: text("product_title").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  notifiedAt: timestamp("notified_at"),
});

export const insertRestockNotificationSchema = createInsertSchema(restockNotifications).omit({
  id: true,
  createdAt: true,
  notifiedAt: true,
});

export type InsertRestockNotification = z.infer<typeof insertRestockNotificationSchema>;
export type RestockNotification = typeof restockNotifications.$inferSelect;
