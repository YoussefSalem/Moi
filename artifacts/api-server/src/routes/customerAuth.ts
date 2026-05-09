import crypto from "crypto";
import { Router, type IRouter } from "express";
import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import { customerOtpCodes } from "@workspace/db";
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

function makeTransporter() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return nodemailer.createTransport({
    host: "smtp.resend.com",
    port: 465,
    secure: true,
    auth: { user: "resend", pass: apiKey },
  });
}

async function sendOtpEmail(to: string, code: string): Promise<void> {
  const transporter = makeTransporter();
  if (!transporter) throw new Error("RESEND_API_KEY not configured");
  await transporter.sendMail({
    from: "Moi <onboarding@resend.dev>",
    to,
    subject: `Your Moi sign-in code: ${code}`,
    html: `
      <div style="font-family:'Montserrat',sans-serif;max-width:480px;margin:0 auto;color:#1e1814;background:#faf8f5;padding:0 24px 48px;text-align:center;">
        <div style="padding:48px 0 28px;letter-spacing:0.4em;font-size:14px;font-weight:700;text-transform:uppercase;text-align:left;">MOI</div>
        <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:34px;font-weight:300;margin:0 0 18px;line-height:1.15;letter-spacing:0.02em;text-align:left;">
          Your Sign-In Code
        </h1>
        <p style="font-size:13px;line-height:1.9;color:#5a5048;margin:0 0 34px;text-align:left;">
          Use the code below to sign in to your Moi account.<br/>It expires in <strong style="color:#1e1814;">5 minutes</strong>.
        </p>
        <div style="display:flex;justify-content:center;margin:0 0 34px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;min-width:220px;padding:16px 12px;background:transparent;color:#1e1814;font-size:30px;font-weight:600;letter-spacing:0.48em;font-family:'Montserrat',sans-serif;line-height:1;">
            ${code}
          </div>
        </div>
        <p style="font-size:11px;color:rgba(30,24,20,0.35);letter-spacing:0.18em;text-transform:uppercase;margin:0;line-height:1.8;">
          If you did not request this code, you can safely ignore this email.
        </p>
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

// POST /api/auth/customer/send-otp
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
      res.status(429).json({ error: "Too many codes requested. Please wait a few minutes before trying again." });
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

// POST /api/auth/customer/verify-otp
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
  const firstName = shopifyCustomer?.first_name ?? null;
  const lastName = shopifyCustomer?.last_name ?? null;

  const token = signCustomerToken({ shopifyId, email: safeEmail, firstName, lastName });
  req.log.info({ email: safeEmail }, "Customer signed in via OTP");
  res.status(200).json({
    token,
    customer: { shopifyId, email: safeEmail, firstName, lastName },
  });
});

// GET /api/auth/customer/me — restore session from stored token
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

export default router;
