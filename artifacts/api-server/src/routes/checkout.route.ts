/**
 * POST /api/checkout
 *
 * Initiates a custom Shopify + Paymob checkout.
 * Rate-limited to prevent abuse.
 */
import { Router } from "express";
import { handleCheckout } from "../controllers/checkout.controller";
import { checkoutLimiter } from "../middleware/rateLimiter";

const router = Router();

router.post("/checkout", checkoutLimiter, handleCheckout);

export default router;
