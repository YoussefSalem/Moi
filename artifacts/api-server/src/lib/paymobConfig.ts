import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "./logger";

export interface PaymobConfig {
  apiKey: string;
  secretKey: string;
  publicKey: string;
  integrationId: string;
  hmacSecret: string;
  iframeId: string;
}

const CONFIG_FILE = join(process.cwd(), "paymob-config.json");

function readConfigFile(): Partial<PaymobConfig> {
  try {
    const raw = readFileSync(CONFIG_FILE, "utf8");
    return JSON.parse(raw) as Partial<PaymobConfig>;
  } catch {
    return {};
  }
}

export function getPaymobConfig(): PaymobConfig {
  const file = readConfigFile();
  return {
    apiKey: file.apiKey ?? process.env.PAYMOB_API_KEY ?? "",
    secretKey: file.secretKey ?? process.env.PAYMOB_SECRET_KEY ?? "",
    publicKey: file.publicKey ?? process.env.PAYMOB_PUBLIC_KEY ?? "",
    integrationId: file.integrationId ?? process.env.PAYMOB_INTEGRATION_ID ?? "",
    hmacSecret: file.hmacSecret ?? process.env.PAYMOB_HMAC_SECRET ?? "",
    iframeId: file.iframeId ?? process.env.PAYMOB_IFRAME_ID ?? "",
  };
}

export function savePaymobConfig(patch: Partial<PaymobConfig>): void {
  const current = readConfigFile();
  const updated = { ...current, ...patch };
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf8");
  } catch (err) {
    logger.error({ err }, "Failed to write paymob-config.json");
    throw err;
  }
}

export function getMaskedConfig(): Record<string, string> {
  const config = getPaymobConfig();
  return {
    apiKey: config.apiKey ? "configured" : "",
    secretKey: config.secretKey ? "configured" : "",
    publicKey: config.publicKey ? "configured" : "",
    integrationId: config.integrationId ? "configured" : "",
    hmacSecret: config.hmacSecret ? "configured" : "",
    iframeId: config.iframeId || "",
  };
}
