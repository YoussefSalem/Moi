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

async function notifyViaShopify(
  storeDomain: string,
  adminToken: string,
  data: {
    name: string;
    email: string;
    phone: string;
    facebook: string;
    instagram: string;
    message: string;
  },
): Promise<void> {
  const noteLines = [
    `=== MOI AMBASSADOR APPLICATION ===`,
    ``,
    data.phone ? `Phone: ${data.phone}` : null,
    data.facebook ? `Facebook: ${data.facebook}` : null,
    data.instagram ? `Instagram: ${data.instagram}` : null,
    ``,
    `--- About the applicant ---`,
    data.message,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const nameParts = data.name.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || "-";

  const body = {
    customer: {
      first_name: firstName,
      last_name: lastName,
      email: data.email,
      phone: data.phone || undefined,
      note: noteLines,
      tags: "ambassador-applicant",
      send_email_welcome: false,
    },
  };

  const url = `https://${storeDomain}/admin/api/2024-01/customers.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminToken,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify Admin API ${res.status}: ${text}`);
  }
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

  // Save to DB first — guaranteed capture
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

  // Notify via Shopify Admin API — creates a tagged customer record
  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;

  if (storeDomain && adminToken) {
    try {
      await notifyViaShopify(storeDomain, adminToken, {
        name: safeName,
        email: safeEmail,
        phone: safePhone,
        facebook: safeFacebook,
        instagram: safeInstagram,
        message: safeMessage,
      });
      req.log.info({ id: dbId }, "Ambassador customer created in Shopify");
    } catch (err) {
      req.log.warn({ err }, "Shopify customer creation failed — application saved to DB");
    }
  } else {
    req.log.warn("SHOPIFY_ADMIN_API_TOKEN or VITE_SHOPIFY_STORE_DOMAIN not set");
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
