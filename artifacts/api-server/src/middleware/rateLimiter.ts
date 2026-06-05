import rateLimit from "express-rate-limit";

/**
 * General API rate limiter — 100 requests per 15 minutes per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please try again later." },
});

/**
 * Strict limiter for checkout initiation — 20 requests per 15 minutes per IP.
 * Prevents checkout abuse and Paymob intention spam.
 */
export const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checkout requests — please slow down." },
});

/**
 * Webhook limiter — 500 requests per minute per IP.
 * High enough for legitimate webhook providers, low enough to block floods.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many webhook requests." },
});
