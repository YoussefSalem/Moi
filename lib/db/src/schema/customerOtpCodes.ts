import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customerOtpCodes = pgTable("customer_otp_codes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  hashedCode: text("hashed_code").notNull(),
  salt: text("salt").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCustomerOtpCodeSchema = createInsertSchema(customerOtpCodes).omit({
  id: true,
  used: true,
  createdAt: true,
});

export type InsertCustomerOtpCode = z.infer<typeof insertCustomerOtpCodeSchema>;
export type CustomerOtpCode = typeof customerOtpCodes.$inferSelect;
