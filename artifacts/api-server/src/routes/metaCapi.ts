import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const PIXEL_ID = "2281707575977889";
const CAPI_URL = `https://graph.facebook.com/v20.0/${PIXEL_ID}/events`;

/**
 * POST /api/capi/event
 *
 * Server-side Meta Conversions API (CAPI) event relay.
 * The browser pixel and this endpoint must send the same event_id so Meta
 * deduplicates them as one event — eliminating the cs_est double-fire.
 *
 * Body fields (all optional except event_name + event_id):
 *   event_name       — "InitiateCheckout" | "Purchase" | "AddToCart" | "ViewContent"
 *   event_id         — must match the eventID passed to fbq() on the client
 *   event_source_url — full page URL at the time of the event
 *   content_ids      — array of variant GIDs
 *   content_type     — "product"
 *   value            — numeric order value
 *   currency         — ISO currency code (default "EGP")
 *   num_items        — item count
 *   fbc              — Meta click-ID cookie (_fbc) from the browser
 *   fbp              — Meta browser-ID cookie (_fbp) from the browser
 *   order_id         — for Purchase events
 */
router.post("/capi/event", async (req, res) => {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) {
    res.status(200).json({ ok: false, reason: "META_CAPI_TOKEN not configured" });
    return;
  }

  const {
    event_name,
    event_id,
    event_source_url,
    content_ids,
    content_type,
    value,
    currency,
    num_items,
    fbc,
    fbp,
    order_id,
  } = req.body as {
    event_name?: string;
    event_id?: string;
    event_source_url?: string;
    content_ids?: string[];
    content_type?: string;
    value?: number;
    currency?: string;
    num_items?: number;
    fbc?: string;
    fbp?: string;
    order_id?: string;
  };

  if (!event_name || !event_id) {
    res.status(400).json({ error: "event_name and event_id are required" });
    return;
  }

  const clientIp =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    undefined;
  const userAgent = req.headers["user-agent"] || undefined;

  const userData: Record<string, string> = {};
  if (clientIp) userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent = userAgent;
  if (fbc) userData.fbc = fbc;
  if (fbp) userData.fbp = fbp;

  const customData: Record<string, unknown> = {
    currency: (currency ?? "EGP").toUpperCase().slice(0, 3),
  };
  if (Array.isArray(content_ids) && content_ids.length > 0) {
    customData.content_ids = content_ids;
  }
  if (content_type) customData.content_type = content_type;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    customData.value = Math.round(value * 100) / 100;
  }
  if (typeof num_items === "number" && num_items > 0) customData.num_items = num_items;
  if (order_id) customData.order_id = order_id;

  const payload = {
    data: [
      {
        event_name,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_id,
        ...(event_source_url ? { event_source_url } : {}),
        user_data: userData,
        custom_data: customData,
      },
    ],
    access_token: token,
  };

  try {
    const capiRes = await fetch(CAPI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await capiRes.json() as unknown;

    if (!capiRes.ok) {
      logger.warn({ status: capiRes.status, body }, "CAPI event rejected by Meta");
      res.status(200).json({ ok: false, status: capiRes.status, body });
      return;
    }

    res.json({ ok: true, body });
  } catch (err) {
    logger.error({ err }, "CAPI fetch failed");
    res.status(200).json({ ok: false, error: String(err) });
  }
});

export default router;
