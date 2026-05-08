import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface AmbassadorBody {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  facebook?: unknown;
  instagram?: unknown;
  about?: unknown;
}

router.post("/ambassador", async (req, res) => {
  const { name, email, phone, facebook, instagram, about } =
    req.body as AmbassadorBody;

  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    typeof email !== "string" ||
    !email.includes("@")
  ) {
    res.status(400).json({ error: "Name and email are required." });
    return;
  }

  const safeName = name.trim();
  const safeEmail = email.trim();
  const safePhone = typeof phone === "string" ? phone.trim() : "";
  const safeFacebook = typeof facebook === "string" ? facebook.trim() : "";
  const safeInstagram = typeof instagram === "string" ? instagram.trim() : "";
  const safeAbout = typeof about === "string" ? about.trim() : "";

  const lines = [
    `Ambassador Application — ${safeName}`,
    `Email: ${safeEmail}`,
    safePhone ? `Phone: ${safePhone}` : "",
    safeFacebook ? `Facebook: ${safeFacebook}` : "",
    safeInstagram ? `Instagram: ${safeInstagram}` : "",
    safeAbout ? `\nAbout:\n${safeAbout}` : "",
  ].filter(Boolean);

  const messageBody = lines.join("\n");

  req.log.info({ name: safeName, email: safeEmail }, "Ambassador application received");

  const shopDomain = process.env["VITE_SHOPIFY_STORE_DOMAIN"];

  if (shopDomain) {
    try {
      const formData = new URLSearchParams({
        form_type: "contact",
        utf8: "✓",
        "contact[name]": safeName,
        "contact[email]": safeEmail,
        "contact[body]": messageBody,
      });

      const shopRes = await fetch(`https://${shopDomain}/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
        redirect: "manual",
      });

      req.log.info(
        { status: shopRes.status },
        "Shopify contact form response",
      );
    } catch (err) {
      req.log.warn({ err }, "Shopify contact form submission failed — logged only");
    }
  } else {
    req.log.warn("VITE_SHOPIFY_STORE_DOMAIN not set — ambassador form logged only");
  }

  res.status(200).json({ success: true });
});

export default router;
