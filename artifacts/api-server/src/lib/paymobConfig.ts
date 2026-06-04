import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

export interface PaymobConfig {
  apiKey: string;
  integrationId: string;
  iframeId: string;
  hmacSecret: string;
}

function readConfigFile(): Partial<Pick<PaymobConfig, "integrationId" | "iframeId">> {
  try {
    const raw = readFileSync(join(process.cwd(), "paymob-config.json"), "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      integrationId: typeof parsed.integrationId === "string" ? parsed.integrationId : undefined,
      iframeId: typeof parsed.iframeId === "string" ? parsed.iframeId : undefined,
    };
  } catch {
    return {};
  }
}

export function getPaymobConfig(): PaymobConfig {
  const file = readConfigFile();
  return {
    apiKey: process.env.PAYMOB_API_KEY ?? "",
    integrationId: process.env.PAYMOB_INTEGRATION_ID ?? file.integrationId ?? "",
    iframeId: process.env.PAYMOB_IFRAME_ID ?? file.iframeId ?? "",
    hmacSecret: process.env.PAYMOB_HMAC_SECRET ?? "",
  };
}

export function getMaskedConfig(): Record<string, string> {
  const cfg = getPaymobConfig();
  return {
    apiKey: cfg.apiKey ? "configured" : "",
    integrationId: cfg.integrationId,
    iframeId: cfg.iframeId,
    hmacSecret: cfg.hmacSecret ? "configured" : "",
  };
}

export function savePaymobConfig(patch: Partial<Pick<PaymobConfig, "integrationId" | "iframeId">>): void {
  const file = readConfigFile();
  const updated = { ...file, ...patch };
  writeFileSync(join(process.cwd(), "paymob-config.json"), JSON.stringify(updated, null, 2), "utf8");
}
