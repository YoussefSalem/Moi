import app from "./app";
import { logger } from "./lib/logger";
import { registerRestockWebhooks } from "./lib/shopifyWebhook";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Log Resend key diagnostics (values masked)
  const audienceKey = process.env["RESEND_API_KEY_AUDIENCE"];
  const sendKey = process.env["RESEND_CHECKOUT_KEY"] ?? process.env["RESEND_API_KEY"];
  const keysAreIdentical = !!audienceKey && audienceKey === sendKey;
  logger.info({
    resendAudienceKeyPresent: !!audienceKey,
    resendAudienceKeyLength: audienceKey?.length ?? 0,
    resendAudienceKeyPrefix: audienceKey?.slice(0, 12) ?? "(none)",
    resendSendKeyPresent: !!sendKey,
    resendSendKeyLength: sendKey?.length ?? 0,
    resendSendKeyPrefix: sendKey?.slice(0, 12) ?? "(none)",
    resendCheckoutKeyPresent: !!process.env["RESEND_CHECKOUT_KEY"],
    resendCheckoutKeyPrefix: process.env["RESEND_CHECKOUT_KEY"]?.slice(0, 12) ?? "(none)",
    audienceId: process.env["RESEND_AUDIENCE_ID"] ?? "(none)",
    audienceSyncEnabled: !keysAreIdentical,
  }, keysAreIdentical
    ? "Resend config resolved — WARNING: RESEND_API_KEY_AUDIENCE is identical to RESEND_API_KEY (audience sync disabled until a full-access key is set)"
    : "Resend config resolved");

  // Log Paymob configuration presence (values masked) for observability
  const sk = (process.env["PAYMOB_SECRET_KEY"] ?? "").trim();
  const pk = (process.env["PAYMOB_PUBLIC_KEY"] ?? "").trim();
  logger.info({
    paymobApiKey: !!process.env["PAYMOB_API_KEY"]?.trim(),
    paymobPublicKeyLength: pk.length,
    paymobPublicKeyPrefix: pk.slice(0, 8) || "(empty)",
    paymobSecretKeyLength: sk.length,
    paymobSecretKeyPrefix: sk.slice(0, 8) || "(empty)",
    paymobIntegrationId: (process.env["PAYMOB_INTEGRATION_ID"] ?? "").trim() || "(missing)",
    paymobHmacSecret: !!process.env["PAYMOB_HMAC_SECRET"]?.trim(),
    paymobIframeId: (process.env["PAYMOB_IFRAME_ID"] ?? "").trim() || "(missing)",
  }, "Paymob config resolved");

  // Register Shopify webhooks for automatic restock notifications
  registerRestockWebhooks().catch((e) =>
    logger.warn({ err: e }, "Webhook registration error"),
  );
});
