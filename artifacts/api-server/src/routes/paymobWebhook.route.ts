/**
 * POST /api/webhooks/paymob
 *
 * Receives Paymob transaction webhooks.
 * Raw body is required for HMAC verification — wired in app.ts.
 */
import { Router } from "express";
import { handlePaymobWebhook } from "../controllers/webhook.controller";
import { webhookLimiter } from "../middleware/rateLimiter";

const router = Router();

router.post("/webhooks/paymob", webhookLimiter, handlePaymobWebhook);

export default router;
