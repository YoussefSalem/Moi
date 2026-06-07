import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import type { LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { Toaster } from "sonner";
import stylesheet from "~/styles/app.css?url";
import { useEffect } from "react";
import { captureAttribution } from "~/lib/adAttribution";
import { initAnalytics } from "~/lib/analytics";
import { trackShopifyPageView } from "~/lib/shopifyAnalytics";

export function links() {
  return [
    { rel: "stylesheet", href: stylesheet },
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Montserrat:wght@300;400;500;600&display=swap",
    },
  ];
}

export async function loader({ context }: LoaderFunctionArgs) {
  const { env } = context;
  return {
    ENV: {
      PUBLIC_STORE_DOMAIN: env.PUBLIC_STORE_DOMAIN,
      PUBLIC_STOREFRONT_ID: env.PUBLIC_STOREFRONT_ID,
      PUBLIC_API_ORIGIN: env.PUBLIC_API_ORIGIN,
      PUBLIC_META_PIXEL_ID: env.PUBLIC_META_PIXEL_ID,
      PUBLIC_TIKTOK_PIXEL_ID: env.PUBLIC_TIKTOK_PIXEL_ID,
      PUBLIC_GA_MEASUREMENT_ID: env.PUBLIC_GA_MEASUREMENT_ID,
      PUBLIC_CHECKOUT_DOMAIN: env.PUBLIC_CHECKOUT_DOMAIN,
    },
  };
}

export default function App() {
  const data = useLoaderData<typeof loader>();

  useEffect(() => {
    captureAttribution();
    initAnalytics();
    trackShopifyPageView();
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="theme-color" content="#faf8f5" />
        <Meta />
        <Links />
        {/* Meta Pixel */}
        {data.ENV.PUBLIC_META_PIXEL_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
                n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
                document,'script','https://connect.facebook.net/en_US/fbevents.js');
                fbq('init','${data.ENV.PUBLIC_META_PIXEL_ID}');
                fbq('track','PageView');
              `,
            }}
          />
        )}
        {/* TikTok Pixel */}
        {data.ENV.PUBLIC_TIKTOK_PIXEL_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${data.ENV.PUBLIC_TIKTOK_PIXEL_ID}');ttq.page();}(window,document,'ttq');
              `,
            }}
          />
        )}
        {/* Google Analytics 4 */}
        {data.ENV.PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${data.ENV.PUBLIC_GA_MEASUREMENT_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer=window.dataLayer||[];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js',new Date());
                  gtag('config','${data.ENV.PUBLIC_GA_MEASUREMENT_ID}',{page_path:window.location.pathname});
                `,
              }}
            />
          </>
        )}
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(data.ENV)}`,
          }}
        />
        <Outlet />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              fontFamily: "'Montserrat', sans-serif",
              fontSize: "11px",
              letterSpacing: "0.12em",
              background: "#1e1814",
              color: "#ffffff",
              border: "none",
            },
            className: "text-white",
            descriptionClassName: "text-white",
          }}
        />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <Meta />
          <Links />
        </head>
        <body style={{ background: "#faf8f5", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "Montserrat, sans-serif" }}>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "4rem", fontWeight: 300, color: "#1e1814" }}>
              {error.status}
            </h1>
            <p style={{ fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(30,24,20,0.6)" }}>
              {error.statusText}
            </p>
            <a href="/" style={{ display: "inline-block", marginTop: "2rem", fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814", textDecoration: "none", borderBottom: "1px solid #1e1814", paddingBottom: "2px" }}>
              Return home
            </a>
          </div>
          <Scripts />
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body style={{ background: "#faf8f5", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "Montserrat, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "2.5rem", fontWeight: 300, color: "#1e1814" }}>
            Something went wrong
          </h1>
          <a href="/" style={{ display: "inline-block", marginTop: "2rem", fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e1814", textDecoration: "none", borderBottom: "1px solid #1e1814", paddingBottom: "2px" }}>
            Return home
          </a>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
