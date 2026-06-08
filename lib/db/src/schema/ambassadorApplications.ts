import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ambassadorApplications = pgTable("ambassador_applications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  facebook: text("facebook").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  tiktok: text("tiktok").notNull().default(""),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAmbassadorApplicationSchema = createInsertSchema(ambassadorApplications).omit({
  id: true,
  createdAt: true,
});

export type InsertAmbassadorApplication = z.infer<typeof insertAmbassadorApplicationSchema>;
export type AmbassadorApplication = typeof ambassadorApplications.$inferSelect;
