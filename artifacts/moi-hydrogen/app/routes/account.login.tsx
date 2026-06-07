import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@shopify/remix-oxygen";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";

export const meta: MetaFunction = () => [{ title: "Sign In — Moi" }];

export async function loader({ context }: LoaderFunctionArgs) {
  const token = await context.session.get("customerAccessToken");
  if (token) return redirect("/account");
  return json({});
}

export async function action({ context, request }: ActionFunctionArgs) {
  const { storefront, session } = context;
  const formData = await request.formData();
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return json({ error: "Email and password are required." }, { status: 400 });
  }

  const { customerAccessTokenCreate } = await storefront.mutate<{
    customerAccessTokenCreate: {
      customerAccessToken: { accessToken: string; expiresAt: string } | null;
      customerUserErrors: Array<{ message: string }>;
    };
  }>(
    `#graphql
    mutation CustomerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
      customerAccessTokenCreate(input: $input) {
        customerAccessToken { accessToken expiresAt }
        customerUserErrors { message }
      }
    }`,
    { variables: { input: { email, password } } },
  );

  const token = customerAccessTokenCreate.customerAccessToken;
  if (!token) {
    const msg = customerAccessTokenCreate.customerUserErrors[0]?.message ?? "Invalid email or password.";
    return json({ error: msg }, { status: 401 });
  }

  session.set("customerAccessToken", token.accessToken);
  return redirect("/account", { headers: { "Set-Cookie": await session.commit() } });
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  return (
    <div style={{ backgroundColor: "#faf8f5", minHeight: "100vh" }}>
      <div style={{ paddingTop: "max(5rem, env(safe-area-inset-top) + 4rem)" }} className="max-w-md mx-auto px-6 pb-20">
        <Link to="/" className="inline-flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase mb-10 transition-opacity hover:opacity-50" style={{ color: "#7a6e64" }}>
          <span style={{ fontFamily: "monospace" }}>←</span> Back
        </Link>
        <h1 className="font-serif font-light mb-8" style={{ color: "#1e1814", fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>Sign In</h1>

        <Form method="post" className="space-y-4">
          <div>
            <label className="block text-[9px] tracking-[0.3em] uppercase mb-1.5" style={{ color: "#7a6e64" }}>Email</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="your@email.com"
              className="checkout-input w-full px-4 py-3 text-sm border outline-none transition-colors"
              style={{ borderColor: "rgba(30,24,20,0.15)", backgroundColor: "white", color: "#1e1814" }}
            />
          </div>
          <div>
            <label className="block text-[9px] tracking-[0.3em] uppercase mb-1.5" style={{ color: "#7a6e64" }}>Password</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="checkout-input w-full px-4 py-3 text-sm border outline-none transition-colors"
              style={{ borderColor: "rgba(30,24,20,0.15)", backgroundColor: "white", color: "#1e1814" }}
            />
          </div>

          {actionData?.error && (
            <p className="text-[11px]" style={{ color: "#a0522d" }}>{actionData.error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 text-[11px] tracking-[0.28em] uppercase text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: "#1e1814" }}
          >
            {isLoading ? "Signing in…" : "Sign In"}
          </button>
        </Form>

        <div className="mt-6 text-center space-y-3">
          <Link to="/account/register" className="block text-[11px] tracking-[0.18em]" style={{ color: "rgba(30,24,20,0.5)" }}>
            New here? Create an account
          </Link>
          <Link to="/account/recover" className="block text-[11px] tracking-[0.18em]" style={{ color: "rgba(30,24,20,0.5)" }}>
            Forgot your password?
          </Link>
        </div>
      </div>
    </div>
  );
}
