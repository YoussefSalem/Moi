import { logger } from "./logger";

// Note: inventory_levels/update and products/update require additional
// Shopify API scopes not available on all plans. The restock check is instead
// triggered automatically by the frontend polling hook (useRestockChecker).
// This file is kept for future use when those scopes become available.
const WEBHOOK_TOPICS: string[] = [];

interface ShopifyWebhook {
  id: number;
  topic: string;
  address: string;
}

interface WebhookListResponse {
  webhooks: ShopifyWebhook[];
}

interface WebhookCreateResponse {
  webhook?: ShopifyWebhook;
  errors?: Record<string, string[]>;
}

async function listWebhooks(storeDomain: string, adminToken: string): Promise<ShopifyWebhook[]> {
  const res = await fetch(
    `https://${storeDomain}/admin/api/2024-01/webhooks.json?limit=250`,
    {
      headers: {
        "X-Shopify-Access-Token": adminToken,
        "Content-Type": "application/json",
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Shopify webhook list failed: ${res.status}`);
  }
  const json = await res.json() as WebhookListResponse;
  return json.webhooks ?? [];
}

async function createWebhook(
  storeDomain: string,
  adminToken: string,
  topic: string,
  address: string,
): Promise<void> {
  const res = await fetch(
    `https://${storeDomain}/admin/api/2024-01/webhooks.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": adminToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ webhook: { topic, address, format: "json" } }),
    },
  );
  const json = await res.json() as WebhookCreateResponse;
  if (!res.ok) {
    throw new Error(
      `Shopify webhook create failed (${res.status}): ${JSON.stringify(json.errors)}`,
    );
  }
  logger.info({ topic, address, id: json.webhook?.id }, "Shopify webhook registered");
}

export async function registerRestockWebhooks(): Promise<void> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
  const domains = process.env.REPLIT_DOMAINS;

  if (!storeDomain || !adminToken || !domains) {
    logger.warn(
      { storeDomain: !!storeDomain, adminToken: !!adminToken, domains: !!domains },
      "Skipping Shopify webhook registration — missing config",
    );
    return;
  }

  // Use the first domain (production or dev)
  const primaryDomain = domains.split(",")[0].trim();
  const webhookUrl = `https://${primaryDomain}/api/restock/check-and-notify`;

  let existing: ShopifyWebhook[];
  try {
    existing = await listWebhooks(storeDomain, adminToken);
  } catch (err) {
    logger.warn({ err }, "Could not list Shopify webhooks — skipping registration");
    return;
  }

  for (const topic of WEBHOOK_TOPICS) {
    const alreadyRegistered = existing.some(
      (w) => w.topic === topic && w.address === webhookUrl,
    );
    if (alreadyRegistered) {
      logger.info({ topic, webhookUrl }, "Shopify webhook already registered");
      continue;
    }
    try {
      await createWebhook(storeDomain, adminToken, topic, webhookUrl);
    } catch (err) {
      logger.warn({ err, topic }, "Failed to register Shopify webhook");
    }
  }
}
