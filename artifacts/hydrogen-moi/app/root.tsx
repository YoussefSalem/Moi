import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNonce,
  useRouteError,
  isRouteErrorResponse,
} from '@remix-run/react';
import { Analytics, useAnalytics, getSeoMeta } from '@shopify/hydrogen';
import { defer, type LoaderFunctionArgs, type AppLoadContext } from '@shopify/remix-oxygen';
import { useEffect } from 'react';
import { Toaster } from 'sonner';
import appStyles from '~/styles/app.css?url';
import type { CartApiQueryFragment, FooterQuery, HeaderQuery } from 'storefrontapi.generated';

export function links() {
  return [
    { rel: 'stylesheet', href: appStyles },
    { rel: 'preconnect', href: 'https://cdn.shopify.com' },
    { rel: 'preconnect', href: 'https://shop.app' },
    {
      rel: 'preconnect',
      href: 'https://fonts.googleapis.com',
    },
    {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossOrigin: 'anonymous' as const,
    },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600;700&display=swap',
    },
  ];
}

export async function loader({ context }: LoaderFunctionArgs) {
  const { storefront, customerAccount, cart } = context;

  const publicStoreDomain = context.env.PUBLIC_STORE_DOMAIN;

  const isLoggedInPromise = customerAccount.isLoggedIn();
  const cartPromise = cart.get();

  const shopPromise = storefront.query(SHOP_QUERY, {
    cache: storefront.CacheShort(),
  });

  return defer({
    cart: cartPromise,
    isLoggedIn: isLoggedInPromise,
    publicStoreDomain,
    shop: shopPromise,
    selectedLocale: storefront.i18n,
  });
}

export const meta = getSeoMeta({
  title: 'Moi — Premium Fashion & Versatile Tops',
  description:
    'Shop Moi — premium versatile tops, elegant clothing and curated fashion accessories designed for effortless everyday style. Delivery across Egypt in 2–4 days.',
});

export default function App() {
  const nonce = useNonce();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
        {/* Google tag (gtag.js) – replace with your GA ID */}
      </head>
      <body>
        <Analytics.Provider>
          <Outlet />
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '11px',
                letterSpacing: '0.12em',
                background: '#1e1814',
                color: '#ffffff',
                border: 'none',
              },
            }}
          />
        </Analytics.Provider>
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const nonce = useNonce();
  let errorMessage = 'Unknown error';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage = error.data?.message ?? error.data;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div
          className="min-h-screen flex flex-col items-center justify-center"
          style={{ backgroundColor: '#faf8f5', color: '#1e1814' }}
        >
          <h1
            className="text-6xl"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: '0.1em' }}
          >
            {errorStatus}
          </h1>
          <p
            className="mt-4 text-sm tracking-widest uppercase"
            style={{ fontFamily: "'Montserrat', sans-serif", color: '#7a6e64' }}
          >
            {errorMessage}
          </p>
          <a
            href="/"
            className="mt-8 text-xs tracking-[0.3em] uppercase border px-6 py-3 transition-colors hover:bg-[#1e1814] hover:text-white"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              borderColor: '#1e1814',
              color: '#1e1814',
            }}
          >
            Back to home
          </a>
        </div>
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

const SHOP_QUERY = `#graphql
  query layout {
    shop {
      id
      name
      description
      primaryDomain {
        url
      }
      brand {
        logo {
          image {
            url
          }
        }
      }
    }
  }
` as const;
