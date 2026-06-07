import { json, redirect, type LoaderFunctionArgs, type MetaFunction, type ActionFunctionArgs } from "@shopify/remix-oxygen";
import { Form, Link, useLoaderData, useActionData } from "@remix-run/react";

export const meta: MetaFunction = () => [{ title: "Account — Moi" }];

export async function loader({ context }: LoaderFunctionArgs) {
  const customerAccessToken = await context.session.get("customerAccessToken");
  if (!customerAccessToken) return redirect("/account/login");
  const { storefront } = context;
  const { customer } = await storefront.query<{ customer: { firstName: string; lastName: string; email: string; orders: { nodes: Array<{ id: string; name: string; processedAt: string; financialStatus: string; fulfillmentStatus: string; currentTotalPrice: { amount: string; currencyCode: string } }> } } | null }>(
    `#graphql
    query CustomerAccount($customerAccessToken: String!) {
      customer(customerAccessToken: $customerAccessToken) {
        firstName
        lastName
        email
        orders(first: 10, sortKey: PROCESSED_AT, reverse: true) {
          nodes {
            id
            name
            processedAt
            financialStatus
            fulfillmentStatus
            currentTotalPrice {
              amount
              currencyCode
            }
          }
        }
      }
    }`,
    { variables: { customerAccessToken } },
  );
  if (!customer) {
    context.session.unset("customerAccessToken");
    return redirect("/account/login");
  }
  return json({ customer });
}

export async function action({ context, request }: ActionFunctionArgs) {
  const { session } = context;
  session.unset("customerAccessToken");
  return redirect("/account/login", { headers: { "Set-Cookie": await session.commit() } });
}

export default function Account() {
  const { customer } = useLoaderData<typeof loader>();
  return (
    <div style={{ backgroundColor: "#faf8f5", minHeight: "100vh" }}>
      <div style={{ paddingTop: "max(5rem, env(safe-area-inset-top) + 4rem)" }} className="max-w-2xl mx-auto px-6 pb-20">
        <div className="flex items-center justify-between mb-10">
          <Link to="/" className="text-[10px] tracking-[0.25em] uppercase transition-opacity hover:opacity-50" style={{ color: "#7a6e64" }}>
            ← Back to Shop
          </Link>
          <Form method="post">
            <button type="submit" className="text-[10px] tracking-[0.25em] uppercase transition-opacity hover:opacity-50" style={{ color: "rgba(30,24,20,0.4)" }}>
              Sign Out
            </button>
          </Form>
        </div>

        <h1 className="font-serif font-light mb-2" style={{ color: "#1e1814", fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
          {customer.firstName} {customer.lastName}
        </h1>
        <p className="text-sm mb-10" style={{ color: "rgba(30,24,20,0.5)" }}>{customer.email}</p>

        <section>
          <p className="text-[9px] tracking-[0.35em] uppercase mb-4" style={{ color: "#7a6e64" }}>Orders</p>
          {customer.orders.nodes.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm" style={{ color: "rgba(30,24,20,0.4)" }}>No orders yet.</p>
              <Link to="/" className="mt-4 inline-block text-[10px] tracking-[0.2em] uppercase underline" style={{ color: "#1e1814" }}>
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {customer.orders.nodes.map((order) => (
                <div
                  key={order.id}
                  className="p-4 border border-stone-100 flex flex-wrap items-center gap-4"
                  style={{ backgroundColor: "rgba(255,255,255,0.5)" }}
                >
                  <div className="flex-1">
                    <p className="text-[11px] tracking-[0.12em] uppercase font-medium" style={{ color: "#1e1814" }}>{order.name}</p>
                    <p className="text-[10px] mt-1" style={{ color: "rgba(30,24,20,0.45)" }}>
                      {new Date(order.processedAt).toLocaleDateString("en-EG", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-medium" style={{ color: "#1e1814" }}>
                      {Math.round(parseFloat(order.currentTotalPrice.amount)).toLocaleString("en-EG")} {order.currentTotalPrice.currencyCode}
                    </p>
                    <p className="text-[10px] mt-0.5 capitalize" style={{ color: "rgba(30,24,20,0.45)" }}>
                      {order.fulfillmentStatus.toLowerCase()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
