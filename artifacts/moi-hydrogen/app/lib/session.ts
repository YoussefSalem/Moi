import { createCookieSessionStorage } from "@shopify/remix-oxygen";

type SessionData = {
  customerAccessToken: string;
};

type SessionFlashData = {
  error: string;
};

export class AppSession {
  #sessionStorage;
  #session;

  constructor(
    sessionStorage: ReturnType<typeof createCookieSessionStorage>,
    session: Awaited<ReturnType<typeof sessionStorage.getSession>>,
  ) {
    this.#sessionStorage = sessionStorage;
    this.#session = session;
  }

  static async init(request: Request, secrets: string[]) {
    const storage = createCookieSessionStorage<SessionData, SessionFlashData>({
      cookie: {
        name: "__session",
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secrets,
      },
    });

    const session = await storage.getSession(request.headers.get("Cookie"));
    return new AppSession(storage, session);
  }

  get has() {
    return (key: keyof SessionData) => this.#session.has(key);
  }

  get(key: keyof SessionData) {
    return this.#session.get(key);
  }

  set(key: keyof SessionData, value: string) {
    this.#session.set(key, value);
  }

  unset(key: keyof SessionData) {
    this.#session.unset(key);
  }

  flash(key: keyof SessionFlashData, value: string) {
    this.#session.flash(key, value);
  }

  async commit() {
    return this.#sessionStorage.commitSession(this.#session);
  }

  async destroy() {
    return this.#sessionStorage.destroySession(this.#session);
  }
}
