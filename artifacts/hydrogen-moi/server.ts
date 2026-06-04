import {
  createRequestHandler,
  storefrontRedirect,
  createHydrogenContext,
} from '@shopify/hydrogen';
import {
  createCookieSessionStorage,
  type SessionStorage,
  type Session,
} from '@shopify/remix-oxygen';
import * as remixBuild from 'virtual:remix/server-build';

export interface Env {
  SESSION_SECRET: string;
  PUBLIC_STORE_DOMAIN: string;
  PUBLIC_STOREFRONT_API_TOKEN: string;
  PUBLIC_STOREFRONT_API_VERSION?: string;
  PUBLIC_CHECKOUT_DOMAIN?: string;
  PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID?: string;
  PUBLIC_CUSTOMER_ACCOUNT_API_URL?: string;
  HYDROGEN_ASSET_BASE_URL?: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    executionContext: ExecutionContext,
  ): Promise<Response> {
    try {
      const waitUntil = executionContext.waitUntil.bind(executionContext);
      const [cache, session] = await Promise.all([
        caches.open('hydrogen'),
        HydrogenSession.init(request, [env.SESSION_SECRET]),
      ]);

      const hydrogenContext = createHydrogenContext({
        env,
        request,
        cache,
        waitUntil,
        session,
        i18n: { language: 'EN', country: 'EG' },
        cart: {
          checkoutDomain:
            env.PUBLIC_CHECKOUT_DOMAIN ?? env.PUBLIC_STORE_DOMAIN,
        },
      });

      const handleRequest = createRequestHandler({
        build: remixBuild,
        mode: process.env.NODE_ENV,
        getLoadContext: () => ({
          ...hydrogenContext,
          env,
          waitUntil,
          session,
        }),
      });

      const response = await handleRequest(request);

      if (response.status === 404) {
        return storefrontRedirect({
          request,
          response,
          storefront: hydrogenContext.storefront,
        });
      }

      const cookie = await session.commit();
      response.headers.append('Set-Cookie', cookie);

      return response;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      return new Response('An unexpected error occurred', { status: 500 });
    }
  },
};

export class HydrogenSession {
  public readonly headers = new Headers();
  private sessionStorage: SessionStorage;
  private session: Session;

  constructor(sessionStorage: SessionStorage, session: Session) {
    this.sessionStorage = sessionStorage;
    this.session = session;
  }

  static async init(request: Request, secrets: string[]) {
    const storage = createCookieSessionStorage({
      cookie: {
        name: 'session',
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secrets,
      },
    });
    const session = await storage.getSession(
      request.headers.get('Cookie'),
    );
    return new HydrogenSession(storage, session);
  }

  get(key: string) {
    return this.session.get(key);
  }

  set(key: string, value: string) {
    this.session.set(key, value);
  }

  unset(key: string) {
    this.session.unset(key);
  }

  async commit() {
    return this.sessionStorage.commitSession(this.session);
  }

  async destroy() {
    return this.sessionStorage.destroySession(this.session);
  }
}
