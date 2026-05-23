import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";
import { discountCodeUses } from "./schema/discountCodeUses";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";

/**
 * Count how many times a discount code has been used via API-created orders.
 * Shopify does not increment usage_count for draft orders, so we track it here.
 */
export async function countDiscountCodeUses(code: string): Promise<number> {
  const result = await db
    .select({ count: sql<string>`count(*)` })
    .from(discountCodeUses)
    .where(eq(discountCodeUses.code, code.toUpperCase()));
  return Number(result[0]?.count ?? 0);
}

/**
 * Record a discount code use for an API-created order so usage limits are enforced.
 */
export async function insertDiscountCodeUse(
  code: string,
  orderId?: number | null,
  orderNumber?: number | null,
  paymentMethod?: string | null,
): Promise<void> {
  await db.insert(discountCodeUses).values({
    code: code.toUpperCase(),
    orderId: orderId ?? null,
    orderNumber: orderNumber ?? null,
    paymentMethod: paymentMethod ?? null,
  });
}
