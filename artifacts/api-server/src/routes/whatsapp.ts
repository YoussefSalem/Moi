import { Router, type IRouter } from "express";
import { sendWhatsApp } from "../lib/integrations";

const router: IRouter = Router();

interface WhatsAppBody {
  phone?: unknown;
  message?: unknown;
}

router.post("/notify/whatsapp", async (req, res) => {
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
