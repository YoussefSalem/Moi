import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const instapayProofs = pgTable("instapay_proofs", {
  id: serial("id").primaryKey(),
  shopifyOrderId: integer("shopify_order_id").notNull(),
  shopifyOrderNumber: integer("shopify_order_number").notNull(),
  customerPhone: text("customer_phone"),
  customerName: text("customer_name"),
  amount: text("amount"),
  referenceNumber: text("reference_number").notNull(),
  screenshotKey: text("screenshot_key"),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

export const insertInstapayProofSchema = createInsertSchema(instapayProofs).omit({
  id: true,
  submittedAt: true,
  reviewedAt: true,
});

export type InsertInstapayProof = z.infer<typeof insertInstapayProofSchema>;
export type InstapayProof = typeof instapayProofs.$inferSelect;
