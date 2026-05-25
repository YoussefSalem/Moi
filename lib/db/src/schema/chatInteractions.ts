import { pgTable, serial, text, timestamp, integer, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const chatInteractions = pgTable("chat_interactions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  visitorId: text("visitor_id").notNull(),
  /** Event type: open | close | draft_change | send */
  eventType: varchar("event_type", { length: 32 }).notNull(),
  /** Message content for draft_change and send events */
  messageContent: text("message_content"),
  /** Draft sequence number (increments per session per chat open) */
  draftSequence: integer("draft_sequence"),
  /** Extra metadata (panel width, page url, etc.) */
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChatInteractionSchema = createInsertSchema(chatInteractions).omit({
  id: true,
  createdAt: true,
});

export type InsertChatInteraction = z.infer<typeof insertChatInteractionSchema>;
export type ChatInteraction = typeof chatInteractions.$inferSelect;
