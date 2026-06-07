import { json, type ActionFunctionArgs, type MetaFunction } from "@shopify/remix-oxygen";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";

export const meta: MetaFunction = () => [{ title: "Forgot Password — Moi" }];

export async function action({ context, request }: ActionFunctionArgs) {
  const { storefront } = context;
  const formData = await request.formData();
  const email = (formData.get("email") as string)?.trim();

  if (!email) return json({ error: "Email is required." }, { status: 400 });

  try {
    await storefront.mutate(
      `#graphql
      mutation CustomerRecover($email: String!) {
        customerRecover(email: $email) {
          customerUserErrors { message }
        }
      }`,
      { variables: { email } },
    );
    return json({ success: true });
  } catch {
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export default function Recover() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  return (
    <div style={{ backgroundColor: "#faf8f5", minHeight: "100vh" }}>
      <div style={{ paddingTop: "max(5rem, env(safe-area-inset-top) + 4rem)" }} className="max-w-md mx-auto px-6 pb-20">
        <Link to="/account/login" className="inline-flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase mb-10 transition-opacity hover:opacity-50" style={{ color: "#7a6e64" }}>
          <span style={{ fontFamily: "monospace" }}>←</span> Back to Sign In
        </Link>
        <h1 className="font-serif font-light mb-4" style={{ color: "#1e1814", fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>Reset Password</h1>
        <p className="text-sm mb-8" style={{ color: "rgba(30,24,20,0.55)" }}>Enter your email and we'll send you a link to reset your password.</p>

        {(actionData as { success?: boolean })?.success ? (
          <p className="text-sm p-4" style={{ backgroundColor: "rgba(30,24,20,0.05)", color: "#1e1814" }}>
            If an account exists for that email, you'll receive a reset link shortly.
          </p>
        ) : (
          <Form method="post" className="space-y-4">
            <div>
              <label className="block text-[9px] tracking-[0.3em] uppercase mb-1.5" style={{ color: "#7a6e64" }}>Email</label>
              <input name="email" type="email" required placeholder="your@email.com" autoComplete="email"
                className="checkout-input w-full px-4 py-3 text-sm border outline-none"
                style={{ borderColor: "rgba(30,24,20,0.15)", backgroundColor: "white", color: "#1e1814" }} />
            </div>
            {(actionData as { error?: string })?.error && (
              <p className="text-[11px]" style={{ color: "#a0522d" }}>{(actionData as { error?: string }).error}</p>
            )}
            <button type="submit" disabled={isLoading}
              className="w-full py-3.5 text-[11px] tracking-[0.28em] uppercase text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "#1e1814" }}>
              {isLoading ? "Sending…" : "Send Reset Link"}
            </button>
          </Form>
        )}
      </div>
    </div>
  );
}
