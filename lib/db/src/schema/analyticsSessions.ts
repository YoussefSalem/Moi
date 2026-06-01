import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analyticsSessions = pgTable("analytics_sessions", {
  id: serial("id").primaryKey(),
  /** Anonymous visitor fingerprint (hashed) */
  visitorId: text("visitor_id").notNull(),
  /** Unique session ID */
  sessionId: text("session_id").notNull().unique(),
  /** UTM source if available: meta, tiktok, organic */
  utmSource: text("utm_source"),
  /** UTM campaign if available */
  utmCampaign: text("utm_campaign"),
  /** UTM medium if available */
  utmMedium: text("utm_medium"),
  /** Device type: mobile | desktop | tablet */
  deviceType: text("device_type"),
  /** OS: iOS | Android | Windows | macOS | Linux | other */
  os: text("os"),
  /** Browser name */
  browser: text("browser"),
  /** First page viewed */
  entryUrl: text("entry_url"),
  /** Last page viewed */
  exitUrl: text("exit_url"),
  /** Total session duration in seconds */
  durationSeconds: integer("duration_seconds"),
  /** True if session had only 1 page view */
  isBounce: boolean("is_bounce").default(false),
  /** True if this visitor has had previous sessions */
  isReturning: boolean("is_returning").default(false),
  /** Raw user agent string */
  userAgent: text("user_agent"),
  /** IP country (if available) */
  country: text("country"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAnalyticsSessionSchema = createInsertSchema(analyticsSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAnalyticsSession = z.infer<typeof insertAnalyticsSessionSchema>;
export type AnalyticsSession = typeof analyticsSessions.$inferSelect;
