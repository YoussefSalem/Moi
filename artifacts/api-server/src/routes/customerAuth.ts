import crypto from "crypto";
import { Router, type IRouter } from "express";
import { sendEmail } from "../lib/email";
import { db } from "@workspace/db";
import { customerOtpCodes, customerProfiles } from "@workspace/db";
import { eq, and, gt, desc } from "drizzle-orm";
import { getShopifyAdminToken } from "../lib/integrations";

const router: IRouter = Router();

interface CustomerPayload {
  shopifyId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  exp: number;
}

export function signCustomerToken(payload: Omit<CustomerPayload, "exp">): string {
  const secret = process.env.SESSION_SECRET ?? "dev-secret-change-me";
  const data: CustomerPayload = { ...payload, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyCustomerToken(token: string): CustomerPayload | null {
  const secret = process.env.SESSION_SECRET ?? "dev-secret-change-me";
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as CustomerPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function generateOtp(): string {
  return (100000 + crypto.randomInt(0, 900000)).toString();
}

function hashOtp(otp: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(otp).digest("hex");
}

async function sendOtpEmail(to: string, code: string): Promise<void> {
  await sendEmail({
    to,
    subject: `Your Moi sign-in code: ${code}`,
    html: `
      <div style="font-family:'Montserrat',Arial,sans-serif;max-width:520px;margin:0 auto;background:#faf8f5;padding:0;">
        <div style="background:#1e1814;padding:28px 40px;text-align:center;">
          <span style="color:#faf8f5;letter-spacing:0.55em;font-size:13px;font-weight:700;text-transform:uppercase;">M O I</span>
        </div>
        <div style="padding:52px 48px 44px;text-align:center;border-left:1px solid #e8e4de;border-right:1px solid #e8e4de;">
          <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:400;color:#1e1814;margin:0 0 16px;line-height:1.2;letter-spacing:0.03em;">
            Your Sign-In Code
          </h1>
          <p style="font-size:13px;line-height:1.8;color:#5a5048;margin:0 0 40px;font-weight:400;">
            Use the code below to sign in to your Moi account.<br>
            It expires in <strong style="color:#1e1814;font-weight:600;">5 minutes</strong>.
          </p>
          <div style="margin:0 auto 44px;border-top:1px solid #c8c0b4;border-bottom:1px solid #c8c0b4;padding:28px 0;">
            <span style="font-size:38px;font-weight:700;letter-spacing:0.5em;color:#1e1814;font-family:'Courier New',monospace;padding-left:0.5em;">
              ${code}
            </span>
          </div>
          <p style="font-size:11px;color:#7a7068;letter-spacing:0.16em;text-transform:uppercase;margin:0;line-height:1.9;">
            If you did not request this code,<br>you can safely ignore this email.
          </p>
        </div>
        <div style="background:#1e1814;padding:18px 40px;text-align:center;">
          <span style="color:rgba(250,248,245,0.45);font-size:10px;letter-spacing:0.2em;text-transform:uppercase;">moi — premium fashion</span>
        </div>
      </div>
    `,
    text: `Your Moi sign-in code is: ${code}\n\nIt expires in 5 minutes.\n\nIf you didn't request this, ignore this email.`,
  });
}

interface ShopifyAdminCustomer {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

async function findOrCreateShopifyCustomer(email: string): Promise<ShopifyAdminCustomer | null> {
  const token = await getShopifyAdminToken();
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  if (!token || !storeDomain) return null;

  const baseUrl = `https://${storeDomain}/admin/api/2024-04`;
  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": token,
  };

  try {
    const searchRes = await fetch(
      `${baseUrl}/customers/search.json?query=email:${encodeURIComponent(email)}&limit=1`,
      { headers },
    );
    if (searchRes.ok) {
      const data = await searchRes.json() as { customers: ShopifyAdminCustomer[] };
      if (data.customers.length > 0) return data.customers[0];
    }
  } catch {
    // fall through to create
  }

  try {
    const createRes = await fetch(`${baseUrl}/customers.json`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer: { email, email_marketing_consent: { state: "not_subscribed" } },
      }),
    });
    if (createRes.ok) {
      const data = await createRes.json() as { customer: ShopifyAdminCustomer };
      return data.customer;
    }
  } catch {
    // ignore
  }

  return null;
}

router.post("/auth/customer/send-otp", async (req, res) => {
  const { email } = req.body as { email?: unknown };
  if (typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }
  const safeEmail = email.trim().toLowerCase();

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  try {
    const recent = await db
      .select({ id: customerOtpCodes.id })
      .from(customerOtpCodes)
      .where(and(eq(customerOtpCodes.email, safeEmail), gt(customerOtpCodes.createdAt, tenMinAgo)))
      .limit(4);
    if (recent.length >= 3) {
      res.status(429).json({ error: "You've requested a few codes recently. Please wait a moment and try again." });
      return;
    }
  } catch (err) {
    req.log.error({ err }, "Failed to check OTP rate limit");
    res.status(500).json({ error: "Something went wrong. Please try again." });
    return;
  }

  const otp = generateOtp();
  const salt = crypto.randomBytes(16).toString("hex");
  const hashedCode = hashOtp(otp, salt);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  try {
    await sendOtpEmail(safeEmail, otp);
    await db.insert(customerOtpCodes).values({ email: safeEmail, hashedCode, salt, expiresAt });
    req.log.info({ email: safeEmail }, "OTP sent");
    res.status(200).json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to send OTP");
    res.status(500).json({ error: "Could not send the verification code. Please try again." });
  }
});

router.post("/auth/customer/verify-otp", async (req, res) => {
  const { email, code } = req.body as { email?: unknown; code?: unknown };
  if (
    typeof email !== "string" || !email.includes("@") ||
    typeof code !== "string" || code.trim().length === 0
  ) {
    res.status(400).json({ error: "Email and verification code are required." });
    return;
  }
  const safeEmail = email.trim().toLowerCase();
  const safeCode = code.trim();

  let record: typeof customerOtpCodes.$inferSelect | undefined;
  try {
    const now = new Date();
    const rows = await db
      .select()
      .from(customerOtpCodes)
      .where(
        and(
          eq(customerOtpCodes.email, safeEmail),
          eq(customerOtpCodes.used, false),
          gt(customerOtpCodes.expiresAt, now),
        ),
      )
      .orderBy(desc(customerOtpCodes.createdAt))
      .limit(1);
    record = rows[0];
  } catch (err) {
    req.log.error({ err }, "Failed to fetch OTP record");
    res.status(500).json({ error: "Something went wrong. Please try again." });
    return;
  }

  if (!record) {
    res.status(400).json({ error: "Code expired or not found. Please request a new code." });
    return;
  }

  const expected = hashOtp(safeCode, record.salt);
  if (expected !== record.hashedCode) {
    res.status(400).json({ error: "Incorrect code. Please check your email and try again." });
    return;
  }

  try {
    await db.update(customerOtpCodes).set({ used: true }).where(eq(customerOtpCodes.id, record.id));
  } catch (err) {
    req.log.error({ err }, "Failed to mark OTP used");
  }

  const shopifyCustomer = await findOrCreateShopifyCustomer(safeEmail);
  const shopifyId = shopifyCustomer
    ? `gid://shopify/Customer/${shopifyCustomer.id}`
    : `local:${safeEmail}`;

  // Prefer locally stored profile (user edits) over Shopify name
  let firstName = shopifyCustomer?.first_name ?? null;
  let lastName = shopifyCustomer?.last_name ?? null;
  try {
    const localRows = await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.shopifyId, shopifyId))
      .limit(1);
    if (localRows[0]) {
      firstName = localRows[0].firstName ?? firstName;
      lastName = localRows[0].lastName ?? lastName;
    }
  } catch {
    // ignore — fall back to Shopify name
  }

  const token = signCustomerToken({ shopifyId, email: safeEmail, firstName, lastName });
  req.log.info({ email: safeEmail }, "Customer signed in via OTP");
  res.status(200).json({
    token,
    customer: { shopifyId, email: safeEmail, firstName, lastName },
  });
});

router.get("/auth/customer/me", (req, res) => {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const payload = verifyCustomerToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  res.status(200).json({
    customer: {
      shopifyId: payload.shopifyId,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
    },
  });
});

function requireCustomerAuth(req: import("express").Request, res: import("express").Response): CustomerPayload | null {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const payload = verifyCustomerToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired session" });
    return null;
  }
  return payload;
}

function extractShopifyNumericId(shopifyId: string): string | null {
  const match = shopifyId.match(/\/Customer\/(\d+)$/);
  return match ? match[1] : null;
}

interface ShopifyAdminCustomerFull {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  addresses: Array<{
    id: number;
    address1: string | null;
    address2: string | null;
    city: string | null;
    province: string | null;
    country: string | null;
    zip: string | null;
    default: boolean;
  }>;
}

interface ShopifyAdminOrder {
  id: number;
  order_number: number;
  created_at: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  currency: string;
}

router.get("/auth/customer/profile", async (req, res) => {
  const payload = requireCustomerAuth(req, res);
  if (!payload) return;

  const numericId = extractShopifyNumericId(payload.shopifyId);
  if (!numericId) {
    res.status(400).json({ error: "Cannot fetch profile for non-Shopify accounts." });
    return;
  }

  const token = await getShopifyAdminToken();
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  if (!token || !storeDomain) {
    res.status(503).json({ error: "Shopify integration not configured." });
    return;
  }

  try {
    // Fetch addresses from Shopify (read_customers scope available)
    const r = await fetch(
      `https://${storeDomain}/admin/api/2024-04/customers/${numericId}.json`,
      { headers: { "X-Shopify-Access-Token": token } },
    );
    if (!r.ok) {
      res.status(502).json({ error: "Failed to fetch profile from Shopify." });
      return;
    }
    const data = await r.json() as { customer: ShopifyAdminCustomerFull };
    const c = data.customer;

    // Overlay locally stored name/phone (user edits) on top of Shopify data
    let firstName: string | null = c.first_name;
    let lastName: string | null = c.last_name;
    let phone: string | null = c.phone;
    try {
      const localRows = await db
        .select()
        .from(customerProfiles)
        .where(eq(customerProfiles.shopifyId, payload.shopifyId))
        .limit(1);
      if (localRows[0]) {
        firstName = localRows[0].firstName ?? firstName;
        lastName = localRows[0].lastName ?? lastName;
        phone = localRows[0].phone ?? phone;
      }
    } catch {
      // ignore — use Shopify data as fallback
    }

    res.status(200).json({
      firstName,
      lastName,
      email: c.email,
      phone,
      addresses: c.addresses,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Shopify customer profile");
    res.status(500).json({ error: "Something went wrong." });
  }
});

router.put("/auth/customer/profile", async (req, res) => {
  const payload = requireCustomerAuth(req, res);
  if (!payload) return;

  const { firstName, lastName, phone } = req.body as {
    firstName?: unknown;
    lastName?: unknown;
    phone?: unknown;
  };

  const newFirstName = typeof firstName === "string" ? firstName.trim() || null : payload.firstName;
  const newLastName = typeof lastName === "string" ? lastName.trim() || null : payload.lastName;
  const newPhone = typeof phone === "string" ? phone.trim() || null : null;

  try {
    // Save profile locally — Shopify OAuth token only has read_customers scope
    await db
      .insert(customerProfiles)
      .values({
        shopifyId: payload.shopifyId,
        firstName: newFirstName,
        lastName: newLastName,
        phone: newPhone,
      })
      .onConflictDoUpdate({
        target: customerProfiles.shopifyId,
        set: {
          firstName: newFirstName,
          lastName: newLastName,
          phone: newPhone,
          updatedAt: new Date(),
        },
      });

    const newToken = signCustomerToken({
      shopifyId: payload.shopifyId,
      email: payload.email,
      firstName: newFirstName,
      lastName: newLastName,
    });

    req.log.info({ shopifyId: payload.shopifyId }, "Customer profile updated locally");
    res.status(200).json({
      token: newToken,
      firstName: newFirstName,
      lastName: newLastName,
      phone: newPhone,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update customer profile");
    res.status(500).json({ error: "Something went wrong." });
  }
});

router.get("/auth/customer/orders", async (req, res) => {
  const payload = requireCustomerAuth(req, res);
  if (!payload) return;

  const numericId = extractShopifyNumericId(payload.shopifyId);
  if (!numericId) {
    res.status(200).json({ orders: [] });
    return;
  }

  const token = await getShopifyAdminToken();
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  if (!token || !storeDomain) {
    res.status(503).json({ error: "Shopify integration not configured." });
    return;
  }

  try {
    const r = await fetch(
      `https://${storeDomain}/admin/api/2024-04/customers/${numericId}/orders.json?status=any&limit=50`,
      { headers: { "X-Shopify-Access-Token": token } },
    );
    if (!r.ok) {
      res.status(502).json({ error: "Failed to fetch orders from Shopify." });
      return;
    }
    const data = await r.json() as { orders: ShopifyAdminOrder[] };
    const orders = data.orders
      .map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        createdAt: o.created_at,
        financialStatus: o.financial_status,
        fulfillmentStatus: o.fulfillment_status,
        totalPrice: o.total_price,
        currency: o.currency,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.status(200).json({ orders });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Shopify customer orders");
    res.status(500).json({ error: "Something went wrong." });
  }
});

export default router;
