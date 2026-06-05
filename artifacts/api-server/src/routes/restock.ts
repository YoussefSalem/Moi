import { Router, type IRouter } from "express";
import { db, restockNotifications } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";
import { sendEmail } from "../lib/email";

const router: IRouter = Router();

interface SubscribeBody {
  email?: unknown;
  productHandle?: unknown;
  variantId?: unknown;
  variantTitle?: unknown;
  productTitle?: unknown;
}

async function sendRestockEmail(
  to: string,
  productTitle: string,
  variantTitle: string,
): Promise<void> {
  const variantLine =
    variantTitle && variantTitle !== "Default Title" ? ` (${variantTitle})` : "";
  const storeUrl = process.env.STORE_URL ?? "https://buy-moi.com";

  await sendEmail({
    to,
    subject: `${productTitle}${variantLine} is back in stock — Moi`,
    html: `
      <div style="font-family:'Montserrat',sans-serif;max-width:480px;margin:0 auto;color:#1e1814;">
        <div style="padding:40px 0 16px;letter-spacing:0.35em;font-size:13px;font-weight:600;">MOI</div>
        <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;font-weight:300;margin:0 0 16px;line-height:1.2;">
          Back in Stock
        </h1>
        <p style="font-size:13px;line-height:1.8;color:#5a5048;margin:0 0 8px;">
          Good news — <strong style="color:#1e1814;">${productTitle}${variantLine}</strong> is now available again.
        </p>
        <p style="font-size:13px;line-height:1.8;color:#5a5048;margin:0 0 32px;">
          Quantities are limited, so shop soon before it sells out again.
        </p>
        <a href="${storeUrl}" style="display:inline-block;padding:14px 36px;background:#1e1814;color:#fff;text-decoration:none;font-size:10px;letter-spacing:0.32em;text-transform:uppercase;">
          Shop Now
        </a>
        <p style="margin-top:40px;font-size:10px;color:rgba(30,24,20,0.35);letter-spacing:0.2em;text-transform:uppercase;">
          You received this because you signed up for restock alerts on Moi.
        </p>
      </div>
    `,
    text: `${productTitle}${variantLine} is back in stock. Shop now: ${storeUrl}`,
  });
}

// POST /api/restock/subscribe
// Body: { email, productHandle, variantId, variantTitle?, productTitle? }
router.post("/restock/subscribe", async (req, res) => {
  const { email, productHandle, variantId, variantTitle, productTitle } =
    req.body as SubscribeBody;

  if (
    typeof email !== "string" ||
    !email.includes("@") ||
    typeof productHandle !== "string" ||
    productHandle.trim().length === 0 ||
    typeof variantId !== "string" ||
    variantId.trim().length === 0
  ) {
    res.status(400).json({ error: "email, productHandle, and variantId are required." });
    return;
  }

  const safeEmail = email.trim().toLowerCase();
  const safeHandle = productHandle.trim();
  const safeVariantId = variantId.trim();
  const safeVariantTitle = typeof variantTitle === "string" ? variantTitle.trim() : "";
  const safeProductTitle = typeof productTitle === "string" ? productTitle.trim() : safeHandle;

  try {
    // Deduplicate: if already subscribed (not yet notified), just acknowledge
    const existing = await db
      .select({ id: restockNotifications.id })
      .from(restockNotifications)
      .where(
        and(
          eq(restockNotifications.email, safeEmail),
          eq(restockNotifications.variantId, safeVariantId),
          isNull(restockNotifications.notifiedAt),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      res.status(200).json({ success: true, already: true });
      return;
    }

    await db.insert(restockNotifications).values({
      email: safeEmail,
      productHandle: safeHandle,
      variantId: safeVariantId,
      variantTitle: safeVariantTitle,
      productTitle: safeProductTitle,
    });

    req.log.info({ email: safeEmail, variantId: safeVariantId }, "Restock subscription created");
    res.status(200).json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save restock subscription");
    res.status(500).json({ error: "Could not save your notification request. Please try again." });
  }
});

// GET /api/restock/check-and-notify — health check so Shopify can verify the endpoint
router.get("/restock/check-and-notify", (_req, res) => {
  res.status(200).json({ ok: true });
});

// POST /api/restock/check-and-notify
// Called by Shopify webhooks (inventory_levels/update, products/update)
// or on demand. Checks all pending subscriptions and sends emails.
// Requires X-Restock-Token header matching RESTOCK_SECRET env var.
router.post("/restock/check-and-notify", async (req, res) => {
  const secret = process.env.RESTOCK_SECRET;
  if (secret) {
    const provided = req.headers["x-restock-token"];
    if (provided !== secret) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  } else if (process.env.NODE_ENV === "production") {
    req.log.error("RESTOCK_SECRET is not set — blocking unauthenticated restock trigger in production");
    res.status(503).json({ error: "Service not configured" });
    return;
  }
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const storefrontToken = process.env.VITE_SHOPIFY_STOREFRONT_TOKEN;

  if (!storeDomain || !storefrontToken) {
    req.log.warn("Shopify not configured — skipping restock check");
    res.status(200).json({ skipped: true, reason: "Shopify not configured" });
    return;
  }

  let pending: typeof restockNotifications.$inferSelect[];
  try {
    pending = await db
      .select()
      .from(restockNotifications)
      .where(isNull(restockNotifications.notifiedAt));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch pending restock notifications");
    res.status(500).json({ error: "DB error" });
    return;
  }

  if (pending.length === 0) {
    res.status(200).json({ notified: 0, checked: 0 });
    return;
  }

  const uniqueVariantIds = [...new Set(pending.map((r) => r.variantId))];
  const availableVariantIds = new Set<string>();
  const endpoint = `https://${storeDomain}/api/2024-04/graphql.json`;
  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Storefront-Access-Token": storefrontToken,
  };

  try {
    const gqlRes = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `
          query CheckVariants($ids: [ID!]!) {
            nodes(ids: $ids) {
              ... on ProductVariant {
                id
                availableForSale
              }
            }
          }
        `,
        variables: { ids: uniqueVariantIds },
      }),
    });
    const json = await gqlRes.json() as {
      data?: { nodes?: ({ id: string; availableForSale: boolean } | null)[] };
    };
    for (const node of json.data?.nodes ?? []) {
      if (node?.availableForSale) {
        availableVariantIds.add(node.id);
      }
    }
  } catch (err) {
    req.log.warn({ err }, "Failed to batch-check variant availability");
  }

  let notified = 0;
  const now = new Date();

  const eligible = pending.filter((sub) => availableVariantIds.has(sub.variantId));
  await Promise.all(
    eligible.map(async (sub) => {
      try {
        await sendRestockEmail(sub.email, sub.productTitle, sub.variantTitle);
        await db
          .update(restockNotifications)
          .set({ notifiedAt: now })
          .where(eq(restockNotifications.id, sub.id));
        notified++;
        req.log.info({ id: sub.id, email: sub.email }, "Restock email sent");
      } catch (err) {
        req.log.error({ err, id: sub.id }, "Failed to send restock email");
      }
    }),
  );

  res.status(200).json({ notified, checked: uniqueVariantIds.length });
});

export default router;
