/// <reference types="@shopify/remix-oxygen" />
/// <reference types="@shopify/hydrogen" />

import type {
  Storefront,
  CustomerAccount,
  HydrogenCart,
} from '@shopify/hydrogen';
import type { HydrogenSession } from './server';
import type { Env } from './server';

declare module '@shopify/remix-oxygen' {
  interface AppLoadContext {
    env: Env;
    cart: HydrogenCart;
    storefront: Storefront;
    customerAccount: CustomerAccount;
    session: HydrogenSession;
    waitUntil: ExecutionContext['waitUntil'];
  }
}
