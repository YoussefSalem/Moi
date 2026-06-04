import { Suspense, useState, useEffect } from 'react';
import { defer, redirect, type LoaderFunctionArgs } from '@shopify/remix-oxygen';
import { useLoaderData, Await, type MetaFunction } from '@remix-run/react';
import { motion } from 'framer-motion';
import { Package, LogOut } from 'lucide-react';
import { Footer } from '~/components/Footer';
import { formatShopifyPrice } from '~/lib/price';

export const meta: MetaFunction = () => [{ title: 'My Account — Moi' }];

export async function loader({ context }: LoaderFunctionArgs) {
  const { customerAccount } = context;
  const isLoggedIn = await customerAccount.isLoggedIn();

  if (!isLoggedIn) {
    return redirect('/account/login');
  }

  const customerPromise = customerAccount.query(CUSTOMER_QUERY);

  return defer({ customer: customerPromise, isLoggedIn });
}

export default function AccountPage() {
  const { customer } = useLoaderData<typeof loader>();

  return (
    <div style={{ backgroundColor: '#faf8f5', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        <div className="flex items-start justify-between mb-10">
          <div>
            <p
              className="text-[10px] tracking-[0.4em] uppercase mb-2"
              style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}
            >
              Welcome back
            </p>
            <Suspense
              fallback={
                <div className="h-10 w-48 rounded-lg animate-pulse" style={{ backgroundColor: '#f0ece6' }} />
              }
            >
              <Await resolve={customer}>
                {(data) => (
                  <h1
                    style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
                      fontWeight: 300,
                      color: '#1e1814',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {data.customer.firstName} {data.customer.lastName}
                  </h1>
                )}
              </Await>
            </Suspense>
          </div>

          <form method="POST" action="/account/logout">
            <button
              type="submit"
              className="flex items-center gap-2 text-xs tracking-[0.18em] uppercase transition-opacity hover:opacity-60"
              style={{ fontFamily: "'Montserrat', sans-serif", color: '#7a6e64' }}
            >
              <LogOut size={14} strokeWidth={1.5} />
              Sign out
            </button>
          </form>
        </div>

        <Suspense fallback={<OrdersSkeleton />}>
          <Await resolve={customer}>
            {(data) => <OrdersList orders={data.customer.orders.nodes} />}
          </Await>
        </Suspense>
      </div>
      <Footer />
    </div>
  );
}

interface Order {
  id: string;
  orderNumber: number;
  processedAt: string;
  financialStatus: string;
  fulfillmentStatus: string;
  currentTotalPrice: { amount: string; currencyCode: string };
  lineItems: { nodes: Array<{ title: string; quantity: number }> };
}

function OrdersList({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Package size={36} strokeWidth={1} style={{ color: '#c8bfb8' }} />
        <p
          className="text-sm tracking-[0.2em] uppercase"
          style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}
        >
          No orders yet
        </p>
        <a
          href="/"
          className="text-xs tracking-[0.3em] uppercase border px-6 py-3 transition-colors hover:bg-[#1e1814] hover:text-white"
          style={{ fontFamily: "'Montserrat', sans-serif", borderColor: '#1e1814', color: '#1e1814' }}
        >
          Start Shopping
        </a>
      </div>
    );
  }

  return (
    <div>
      <p
        className="text-[10px] tracking-[0.35em] uppercase mb-6"
        style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}
      >
        Order History
      </p>
      <div className="space-y-4">
        {orders.map((order, i) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-5 rounded-xl"
            style={{ backgroundColor: '#fff', border: '1px solid rgba(180,160,140,0.2)' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-sm font-medium"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    color: '#1e1814',
                    letterSpacing: '0.04em',
                  }}
                >
                  Order #{order.orderNumber}
                </p>
                <p
                  className="mt-1 text-[10px] tracking-[0.12em]"
                  style={{ fontFamily: "'Montserrat', sans-serif", color: '#8a7e74' }}
                >
                  {new Date(order.processedAt).toLocaleDateString('en-EG', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <span
                    className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full"
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      backgroundColor: order.financialStatus === 'PAID' ? '#e8f5e9' : '#fff3e0',
                      color: order.financialStatus === 'PAID' ? '#2e7d32' : '#e65100',
                    }}
                  >
                    {order.financialStatus}
                  </span>
                  <span
                    className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full"
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      backgroundColor: 'rgba(30,24,20,0.06)',
                      color: '#7a6e64',
                    }}
                  >
                    {order.fulfillmentStatus}
                  </span>
                </div>
              </div>
              <p
                className="text-sm font-medium whitespace-nowrap"
                style={{ fontFamily: "'Montserrat', sans-serif", color: '#1e1814' }}
              >
                {formatShopifyPrice(order.currentTotalPrice)}
              </p>
            </div>
            <div className="mt-3 border-t border-stone-100 pt-3">
              <p className="text-xs" style={{ fontFamily: "'Montserrat', sans-serif", color: '#8a7e74' }}>
                {order.lineItems.nodes
                  .map((item) => `${item.title} ×${item.quantity}`)
                  .join(', ')}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="p-5 rounded-xl h-24 animate-pulse"
          style={{ backgroundColor: '#f0ece6' }}
        />
      ))}
    </div>
  );
}

const CUSTOMER_QUERY = `#graphql
  query Customer {
    customer {
      firstName
      lastName
      email
      orders(first: 20, sortKey: PROCESSED_AT, reverse: true) {
        nodes {
          id
          orderNumber
          processedAt
          financialStatus
          fulfillmentStatus
          currentTotalPrice {
            amount
            currencyCode
          }
          lineItems(first: 5) {
            nodes {
              title
              quantity
            }
          }
        }
      }
    }
  }
` as const;
