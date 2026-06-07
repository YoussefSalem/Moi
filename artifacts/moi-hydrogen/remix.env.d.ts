/// <reference types="@shopify/remix-oxygen" />
/// <reference types="@shopify/oxygen-workers-types" />

import type { WithCache, CacheKey, CachingStrategy, HydrogenCart } from "@shopify/hydrogen";
import type { Storefront, CustomerAccount } from "@shopify/hydrogen";
import type { AppSession } from "~/lib/session";

declare global {
  interface Env {
    SESSION_SECRET: string;
    PUBLIC_STOREFRONT_API_TOKEN: string;
    PRIVATE_STOREFRONT_API_TOKEN: string;
    PUBLIC_STORE_DOMAIN: string;
    PUBLIC_STOREFRONT_ID: string;
    PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID: string;
    PUBLIC_CUSTOMER_ACCOUNT_API_URL: string;
    PUBLIC_API_ORIGIN: string;
    PUBLIC_META_PIXEL_ID: string;
    PUBLIC_TIKTOK_PIXEL_ID: string;
    PUBLIC_GA_MEASUREMENT_ID: string;
    PUBLIC_CHECKOUT_DOMAIN: string;
  }
}

declare module "@shopify/remix-oxygen" {
  interface AppLoadContext {
    env: Env;
    storefront: Storefront;
    cart: HydrogenCart;
    session: AppSession;
    waitUntil: ExecutionContext["waitUntil"];
    withCache: WithCache;
    CacheLong: CachingStrategy;
    CacheShort: CachingStrategy;
  }
}
