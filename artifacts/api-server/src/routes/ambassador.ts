import { Router, type IRouter } from "express";
import { db, ambassadorApplications } from "@workspace/db";

const router: IRouter = Router();

interface AmbassadorBody {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  facebook?: unknown;
  instagram?: unknown;
  message?: unknown;
}

interface ShopifyFormContext {
  contactId: string;
  cookies: string;
}

async function getShopifyFormContext(storeDomain: string): Promise<ShopifyFormContext | null> {
  const res = await fetch(`https://${storeDomain}/pages/contact`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });

  if (!res.ok) return null;

  const html = await res.text();

  // Extract contact[id] value from the hidden field
  const idMatch = html.match(/name="contact\[id\]"[^>]*value="([^"]+)"/);
  if (!idMatch) return null;

  // Collect all Set-Cookie headers
  const rawCookies = res.headers.getSetCookie?.() ?? [];
  const cookies = rawCookies
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");

  return { contactId: idMatch[1], cookies };
}

router.post("/ambassador", async (req, res) => {
  const { name, phone, email, facebook, instagram, message } =
    req.body as AmbassadorBody;

  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    typeof email !== "string" ||
    !email.includes("@") ||
    typeof message !== "string" ||
    message.trim().length === 0
  ) {
    res.status(400).json({ error: "Name, email and message are required." });
    return;
  }

  const safeName = name.trim();
  const safeEmail = email.trim();
  const safePhone = typeof phone === "string" ? phone.trim() : "";
  const safeFacebook = typeof facebook === "string" ? facebook.trim() : "";
  const safeInstagram = typeof instagram === "string" ? instagram.trim() : "";
  const safeMessage = message.trim();

  req.log.info({ name: safeName, email: safeEmail }, "Ambassador application received");

  const bodyText = [
    `=== MOI AMBASSADOR APPLICATION ===`,
    ``,
    `Name: ${safeName}`,
    `Email: ${safeEmail}`,
    safePhone ? `Phone: ${safePhone}` : null,
    safeFacebook ? `Facebook: ${safeFacebook}` : null,
    safeInstagram ? `Instagram: ${safeInstagram}` : null,
    ``,
    `--- About the applicant ---`,
    safeMessage,
  ]
    .filter((line) => line !== null)
    .join("\n");

  // Always save to database first — guaranteed capture regardless of email
  let dbId: number | undefined;
  try {
    const [row] = await db
      .insert(ambassadorApplications)
      .values({
        name: safeName,
        email: safeEmail,
        phone: safePhone,
        facebook: safeFacebook,
        instagram: safeInstagram,
        message: safeMessage,
      })
      .returning({ id: ambassadorApplications.id });
    dbId = row.id;
    req.log.info({ id: dbId }, "Ambassador application saved to database");
  } catch (err) {
    req.log.error({ err }, "DB insert failed");
    res.status(500).json({ error: "Could not save your application. Please try again." });
    return;
  }

  // Relay to Shopify contact form so the store owner receives an email
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  if (storeDomain) {
    try {
      const ctx = await getShopifyFormContext(storeDomain);

      if (ctx) {
        req.log.info({ contactId: ctx.contactId }, "Shopify form context acquired");

        const params = new URLSearchParams({
          "form_type": "contact",
          "utf8": "✓",
          "contact[id]": ctx.contactId,
          "contact[name]": safeName,
          "contact[email]": safeEmail,
          "contact[phone]": safePhone,
          "contact[body]": bodyText,
        });

        const postRes = await fetch(`https://${storeDomain}/contact`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: `https://${storeDomain}/pages/contact`,
            ...(ctx.cookies ? { Cookie: ctx.cookies } : {}),
          },
          body: params.toString(),
          redirect: "manual",
        });

        req.log.info(
          { status: postRes.status, location: postRes.headers.get("location") },
          "Shopify contact form POST response",
        );
      } else {
        req.log.warn({ storeDomain }, "Could not get Shopify form context");
      }
    } catch (err) {
      req.log.warn({ err }, "Shopify relay failed — application already saved to DB");
    }
  }

  res.status(200).json({ success: true });
});

router.get("/ambassador/applications", async (req, res) => {
  try {
    const applications = await db
      .select()
      .from(ambassadorApplications)
      .orderBy(ambassadorApplications.createdAt);
    res.status(200).json({ applications });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch applications");
    res.status(500).json({ error: "Could not fetch applications." });
  }
});

export default router;
