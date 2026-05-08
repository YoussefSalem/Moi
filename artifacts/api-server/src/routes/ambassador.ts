import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface AmbassadorBody {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  facebook?: unknown;
  instagram?: unknown;
  message?: unknown;
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

  req.log.info(
    { name: safeName, email: safeEmail },
    "Ambassador application received",
  );

  const body = [
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

  const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN;

  if (!storeDomain) {
    req.log.warn("VITE_SHOPIFY_STORE_DOMAIN not set — skipping Shopify relay");
    res.status(200).json({ success: true });
    return;
  }

  const params = new URLSearchParams({
    "form_type": "contact",
    "utf8": "✓",
    "contact[name]": safeName,
    "contact[email]": safeEmail,
    "contact[phone]": safePhone,
    "contact[body]": body,
  });

  try {
    const shopifyUrl = `https://${storeDomain}/contact`;
    const response = await fetch(shopifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
      redirect: "manual",
    });

    req.log.info(
      { status: response.status, storeDomain },
      "Shopify contact form response",
    );

    res.status(200).json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Shopify contact form request failed");
    res.status(502).json({ error: "Failed to relay to Shopify." });
  }
});

export default router;
