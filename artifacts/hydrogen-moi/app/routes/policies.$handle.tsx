import { defer, type LoaderFunctionArgs } from '@shopify/remix-oxygen';
import { useLoaderData, type MetaFunction } from '@remix-run/react';
import { ArrowLeft } from 'lucide-react';
import { Footer } from '~/components/Footer';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.policy) return [{ title: 'Policy — Moi' }];
  return [{ title: `${data.policy.title} — Moi` }];
};

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { handle } = params;
  if (!handle) throw new Response('Not found', { status: 404 });

  const { storefront } = context;

  const policyMap: Record<string, string> = {
    privacy: 'privacyPolicy',
    refund: 'refundPolicy',
    return: 'refundPolicy',
    delivery: 'shippingPolicy',
    'shipping-policy': 'shippingPolicy',
    'privacy-policy': 'privacyPolicy',
    'refund-policy': 'refundPolicy',
    'terms-of-service': 'termsOfService',
  };

  const policyKey = policyMap[handle];
  if (!policyKey) throw new Response('Not found', { status: 404 });

  const { shop } = await storefront.query(POLICY_QUERY, {
    cache: storefront.CacheLong(),
  });

  const policy = shop[policyKey as keyof typeof shop] as {
    title: string;
    body: string;
    handle: string;
  } | null;

  if (!policy) {
    // Return a fallback policy if not set up in Shopify
    return defer({
      policy: {
        title: handle.split('-').map((w: string) => w[0]?.toUpperCase() + w.slice(1)).join(' '),
        body: getDefaultPolicy(handle),
        handle,
      },
    });
  }

  return defer({ policy });
}

export default function PolicyPage() {
  const { policy } = useLoaderData<typeof loader>();

  return (
    <div style={{ backgroundColor: '#faf8f5', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-6 pt-28 pb-16">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase mb-12 transition-opacity hover:opacity-60"
          style={{ fontFamily: "'Montserrat', sans-serif", color: '#7a6e64' }}
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          Back
        </a>

        <h1
          className="mb-8"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 300,
            color: '#1e1814',
            letterSpacing: '0.05em',
          }}
        >
          {policy.title}
        </h1>

        <div
          className="prose prose-sm max-w-none"
          style={{
            color: '#4a3f35',
            fontFamily: 'Georgia, serif',
            lineHeight: 1.9,
          }}
          dangerouslySetInnerHTML={{ __html: policy.body }}
        />
      </div>

      <Footer />
    </div>
  );
}

function getDefaultPolicy(handle: string): string {
  if (handle === 'privacy' || handle === 'privacy-policy') {
    return `
      <h2>Privacy Policy</h2>
      <p>This Privacy Policy describes how Moi collects, uses, and shares information about you.</p>
      <h3>Information We Collect</h3>
      <p>We collect information you provide directly to us, such as when you create an account, place an order, or contact us for support.</p>
      <h3>Contact</h3>
      <p>For privacy inquiries: <a href="mailto:hello@buy-moi.com">hello@buy-moi.com</a></p>
    `;
  }
  if (handle === 'refund' || handle === 'return') {
    return `
      <h2>Refund & Return Policy</h2>
      <p>We want you to be happy with your purchase. If you're not satisfied, we're here to help.</p>
      <h3>Returns</h3>
      <p>Items can be returned within 7 days of delivery, unworn and in original packaging with tags attached.</p>
      <h3>Contact</h3>
      <p>To initiate a return: <a href="mailto:hello@buy-moi.com">hello@buy-moi.com</a> or WhatsApp <a href="tel:+201200520083">+20 120 052 0083</a></p>
    `;
  }
  if (handle === 'delivery') {
    return `
      <h2>Delivery Policy</h2>
      <h3>Delivery Timeframes</h3>
      <ul>
        <li>Cairo & Giza: 3–4 working days</li>
        <li>Other governorates: 5–6 working days</li>
      </ul>
      <h3>Shipping Fees</h3>
      <p>Shipping fees are calculated at checkout based on your location.</p>
      <h3>Tracking</h3>
      <p>You will receive tracking details once your order is processed.</p>
    `;
  }
  return '<p>Policy not available.</p>';
}

const POLICY_QUERY = `#graphql
  query Policies {
    shop {
      privacyPolicy { title body handle }
      refundPolicy { title body handle }
      shippingPolicy { title body handle }
      termsOfService { title body handle }
    }
  }
` as const;
