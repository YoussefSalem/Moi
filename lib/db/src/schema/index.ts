// Export your models here. Add one export per file
// export * from "./posts";
//
// Each model/table should ideally be split into different files.
// Each model/table should define a Drizzle table, insert schema, and types:
//
//   import { pgTable, text, serial } from "drizzle-orm/pg-core";
//   import { createInsertSchema } from "drizzle-zod";
//   import { z } from "zod/v4";
//
//   export const postsTable = pgTable("posts", {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//   });
//
//   export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
//   export type InsertPost = z.infer<typeof insertPostSchema>;
//   export type Post = typeof postsTable.$inferSelect;

export * from "./ambassadorApplications";
export * from "./restockNotifications";
export * from "./instapayProofs";
export * from "./customerOtpCodes";
export * from "./paymobIntents";
export * from "./customerProfiles";
export * from "./discountCodeUses";
export * from "./abandonedCarts";
export * from "./analyticsSessions";
export * from "./analyticsEvents";
export * from "./chatInteractions";