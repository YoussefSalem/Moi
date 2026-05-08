import { Router, type IRouter } from "express";
import crypto from "crypto";

const router: IRouter = Router();

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("20")) return digits;
  if (digits.startsWith("0")) return "2" + digits;
  return "20" + digits;
}

async function sendWhatsApp(phone: string, message: string): Promise<void> {
  const token = process.env.WHAPI_API_TOKEN;
  if (!token) return;
  const formatted = formatPhone(phone);
  await fetch("https://gate.whapi.cloud/messages/text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to: formatted + "@s.whatsapp.net", body: message }),
  }).catch(() => {});
}

async function createBostaShipment(params: {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  orderReference: string;
}): Promise<string | null> {
  const apiKey = process.env.BOSTA_API_KEY;
  if (!apiKey) return null;
  const formatted = formatPhone(params.phone);
  try {
    const res = await fetch("https://app.bosta.co/api/v2/deliveries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        type: 10,
        specs: { packageType: "Parcel", size: "SMALL" },
        receiver: {
          firstName: params.firstName,
          lastName: params.lastName,
          phone: formatted,
          address: { city: params.city, firstLine: params.address },
        },
        notes: `Moi Order ${params.orderReference}`,
        cod: 0,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data?: { trackingNumber?: string; _id?: string } };
    return data?.data?.trackingNumber ?? data?.data?._id ?? null;
  } catch {
    return null;
  }
}

async function addOrderNote(orderId: string, note: string): Promise<void> {
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
  if (!storeDomain || !adminToken) return;
  await fetch(`https://${storeDomain}/admin/api/2024-04/orders/${orderId}.json`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminToken,
    },
    body: JSON.stringify({ order: { id: orderId, note } }),
  }).catch(() => {});
}

router.post("/webhooks/orders-paid", async (req, res) => {
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;

  if (webhookSecret) {
    const hmacHeader = req.headers["x-shopify-hmac-sha256"] as string | undefined;
    if (!hmacHeader) {
      res.status(401).json({ error: "Missing HMAC" });
      return;
    }
    const body = JSON.stringify(req.body);
    const hash = crypto
      .createHmac("sha256", webhookSecret)
      .update(body, "utf8")
      .digest("base64");
    if (hash !== hmacHeader) {
      res.status(401).json({ error: "Invalid HMAC" });
      return;
    }
  }

  const order = req.body as {
    id?: number;
    order_number?: number;
    tags?: string;
    total_price?: string;
    customer?: {
      first_name?: string;
      last_name?: string;
      phone?: string;
    };
    shipping_address?: {
      first_name?: string;
      last_name?: string;
      phone?: string;
      address1?: string;
      city?: string;
    };
    note_attributes?: { name: string; value: string }[];
  };

  req.log.info({ orderId: order.id, orderNumber: order.order_number }, "orders/paid webhook received");

  res.status(200).json({ ok: true });

  const tags = order.tags ?? "";
  const isInstapay = tags.includes("instapay");
  const isMoiCheckout = tags.includes("moi-checkout");

  if (!isMoiCheckout) return;

  const phone =
    order.note_attributes?.find((a) => a.name === "customer_phone")?.value ??
    order.shipping_address?.phone ??
    order.customer?.phone ??
    "";

  const firstName =
    order.shipping_address?.first_name ?? order.customer?.first_name ?? "";
  const lastName =
    order.shipping_address?.last_name ?? order.customer?.last_name ?? "";
  const address = order.shipping_address?.address1 ?? "";
  const city = order.shipping_address?.city ?? "";
  const orderRef = `#${order.order_number ?? order.id}`;
  const total = order.total_price ?? "";

  if (phone) {
    void sendWhatsApp(
      phone,
      `✅ Payment confirmed for your Moi order ${orderRef}!\n\nTotal: ${total} EGP\n\nYour order is now being prepared for shipping. You will receive a tracking update soon. Thank you for shopping with Moi. 🖤`,
    );
  }

  if (isInstapay && firstName) {
    const trackingNumber = await createBostaShipment({
      firstName,
      lastName,
      phone,
      address,
      city,
      orderReference: orderRef,
    });
    if (trackingNumber && order.id) {
      void addOrderNote(
        String(order.id),
        `Bosta tracking: ${trackingNumber}`,
      );
    }
  }
});

export default router;
