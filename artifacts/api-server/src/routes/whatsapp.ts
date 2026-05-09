import { Router, type IRouter } from "express";
import { sendWhatsApp } from "../lib/integrations";

const router: IRouter = Router();

function requireInternalAuth(
  req: Parameters<Parameters<typeof router.post>[1]>[0],
  res: Parameters<Parameters<typeof router.post>[1]>[1],
): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    // Secret not configured — deny all requests to avoid open relay
    res.status(503).json({ error: "Internal auth not configured." });
    return false;
  }
  const auth = req.headers["x-internal-secret"];
  if (auth !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

interface WhatsAppBody {
  phone?: unknown;
  message?: unknown;
}

router.post("/notify/whatsapp", async (req, res) => {
  if (!requireInternalAuth(req, res)) return;

  const body = req.body as WhatsAppBody;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!phone || !message) {
    res.status(400).json({ error: "phone and message are required." });
    return;
  }

  if (!process.env.WHAPI_API_TOKEN) {
    res.status(503).json({ error: "WhatsApp notifications not configured." });
    return;
  }

  try {
    await sendWhatsApp(phone, message);
    res.status(200).json({ success: true });
  } catch (err) {
    req.log.error({ err }, "WhatsApp send failed");
    res.status(500).json({ error: "Failed to send WhatsApp message." });
  }
});

export default router;
