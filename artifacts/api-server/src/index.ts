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
  const sendKey = process.env["RESEND_API_KEY"];
  logger.info({
    resendAudienceKeyPresent: !!audienceKey,
    resendAudienceKeyLength: audienceKey?.length ?? 0,
    resendAudienceKeyPrefix: audienceKey?.slice(0, 6) ?? "(none)",
    resendSendKeyPresent: !!sendKey,
    resendSendKeyLength: sendKey?.length ?? 0,
    resendSendKeyPrefix: sendKey?.slice(0, 6) ?? "(none)",
    audienceId: process.env["RESEND_AUDIENCE_ID"] ?? "(none)",
  }, "Resend config resolved");

  // Log Paymob configuration presence (values masked) for observability
  logger.info({
    paymobApiKey: !!process.env["PAYMOB_API_KEY"],
    paymobPublicKey: !!process.env["PAYMOB_PUBLIC_KEY"],
    paymobSecretKey: !!process.env["PAYMOB_SECRET_KEY"],
    paymobIntegrationId: !!process.env["PAYMOB_INTEGRATION_ID"],
    paymobHmacSecret: !!process.env["PAYMOB_HMAC_SECRET"],
  }, "Paymob config resolved");

  // Register Shopify webhooks for automatic restock notifications
  registerRestockWebhooks().catch((e) =>
    logger.warn({ err: e }, "Webhook registration error"),
  );
});
