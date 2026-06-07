import {
  createRequestHandler,
  getStorefrontHeaders,
  createStorefrontClient,
} from "@shopify/remix-oxygen";
import {
  createWithCache,
  CacheLong,
  CacheShort,
  createCartHandler,
  cartGetIdDefault,
  cartSetIdDefault,
} from "@shopify/hydrogen";
import * as remixBuild from "virtual:remix/server-build";
import { AppSession } from "~/lib/session";

export default {
  async fetch(
    request: Request,
    env: Env,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    try {
      const waitUntil = (p: Promise<unknown>) =>
        executionContext.waitUntil(p);
      const [cache, session] = await Promise.all([
        caches.open("hydrogen"),
        AppSession.init(request, [env.SESSION_SECRET]),
      ]);

      const { storefront } = createStorefrontClient({
        cache,
        waitUntil,
        i18n: { language: "EN", country: "EG" },
        publicStorefrontToken: env.PUBLIC_STOREFRONT_API_TOKEN,
        privateStorefrontToken: env.PRIVATE_STOREFRONT_API_TOKEN,
        storeDomain: env.PUBLIC_STORE_DOMAIN,
        storefrontId: env.PUBLIC_STOREFRONT_ID,
        storefrontHeaders: getStorefrontHeaders(request),
      });

      const cart = createCartHandler({
        storefront,
        getCartId: cartGetIdDefault(request.headers),
        setCartId: cartSetIdDefault(),
      });

      const withCache = createWithCache({ cache, waitUntil, request });

      const handleRequest = createRequestHandler({
        build: remixBuild,
        mode: process.env.NODE_ENV,
        getLoadContext: () => ({
          session,
          storefront,
          cart,
          env,
          waitUntil,
          withCache,
          CacheLong,
          CacheShort,
        }),
      });

      const response = await handleRequest(request);

      if (response.status === 200) {
        session.commit();
      }
      return response;
    } catch (error) {
      console.error(error);
      return new Response("An unexpected error occurred", { status: 500 });
    }
  },
};
