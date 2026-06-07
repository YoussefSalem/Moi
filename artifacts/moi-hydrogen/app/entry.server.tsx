import type { AppLoadContext, EntryContext } from "@shopify/remix-oxygen";
import { RemixServer } from "@remix-run/react";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { createContentSecurityPolicy } from "@shopify/hydrogen";

export const streamTimeout = 5000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  context: AppLoadContext,
) {
  const { nonce, header, NonceProvider } = createContentSecurityPolicy({
    shop: {
      checkoutDomain: context.env.PUBLIC_CHECKOUT_DOMAIN || '',
      storeDomain: context.env.PUBLIC_STORE_DOMAIN || '',
    },
    directives: {
      defaultSrc: [
        "'self'",
        "cdn.shopify.com",
        "*.shopifycdn.com",
        "*.shopifysvc.com",
        "monorail-edge.shopifysvc.com",
      ],
      imgSrc: [
        "'self'",
        "data:",
        "cdn.shopify.com",
        "*.shopifycdn.com",
        "images.unsplash.com",
        "*.tiktokcdn.com",
        "p16-sign.tiktokcdn-us.com",
      ],
      scriptSrc: [
        "'self'",
        "https://connect.facebook.net",
        "https://analytics.tiktok.com",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "'unsafe-inline'",
      ],
      connectSrc: [
        "'self'",
        "https://admin.buy-moi.com",
        "https://monorail-edge.shopifysvc.com",
        "https://graph.facebook.com",
        "https://analytics.tiktok.com",
        "https://www.google-analytics.com",
      ],
    },
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <RemixServer context={remixContext} url={request.url} />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get("user-agent") ?? "")) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  responseHeaders.set("Content-Security-Policy", header);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
