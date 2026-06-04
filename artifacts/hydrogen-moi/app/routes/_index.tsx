import { defer, type LoaderFunctionArgs } from '@shopify/remix-oxygen';
import { useLoaderData, type MetaFunction } from '@remix-run/react';
import { Suspense, useState, useEffect } from 'react';
import { HeroVideo } from '~/components/HeroVideo';
import { ProductColorSection } from '~/components/ProductColorSection';
import { EditorialStrip } from '~/components/EditorialStrip';
import { Footer } from '~/components/Footer';
import { LoadingScreen } from '~/components/LoadingScreen';
import { PRODUCT_FRAGMENT } from '~/lib/fragments';

export const meta: MetaFunction = () => {
  return [
    { title: 'Moi — New Summer Drop | Premium Fashion' },
    {
      name: 'description',
      content:
        'Shop the new summer drop from Moi. Premium versatile tops, elegant clothing and curated accessories. Delivery across Egypt in 2–4 days.',
    },
    { property: 'og:title', content: 'Moi — New Summer Drop' },
    {
      property: 'og:description',
      content: 'Premium fashion designed for effortless everyday style.',
    },
    { property: 'og:image', content: '/hero-image.jpeg' },
  ];
};

const WAVVY_COLORS = [{ name: 'Light Blue' }, { name: 'Navy' }, { name: 'Mint' }];
const VERSA_COLORS = [
  { name: 'White' },
  { name: 'Cashmere' },
  { name: 'Beige' },
  { name: 'Yellow' },
  { name: 'Teal' },
];

export async function loader({ context }: LoaderFunctionArgs) {
  const { storefront } = context;

  const wavvyPromise = storefront.query(PRODUCT_BY_HANDLE_QUERY, {
    variables: { handle: 'moi-wavvy' },
    cache: storefront.CacheLong(),
  });

  const versaPromise = storefront.query(PRODUCT_BY_HANDLE_QUERY, {
    variables: { handle: 'moi-versa-top' },
    cache: storefront.CacheLong(),
  });

  return defer({
    wavvy: wavvyPromise,
    versa: versaPromise,
  });
}

export default function Index() {
  const { wavvy, versa } = useLoaderData<typeof loader>();
  const [heroReady, setHeroReady] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#faf8f5' }}>
      <LoadingScreen ready={heroReady} />

      <HeroVideo onReady={() => setHeroReady(true)} />

      {/* Trust bar */}
      <div
        className="w-full flex items-center justify-center gap-4 md:gap-8 py-4 px-4"
        style={{ backgroundColor: '#faf8f5' }}
      >
        {[
          { emoji: '☀️', text: 'New summer drop' },
          { emoji: '⚡', text: 'Fast delivery across Egypt' },
          { emoji: '🔥', text: 'Limited stock available' },
        ].map((item) => (
          <div key={item.text} className="flex items-center gap-1.5">
            <span className="text-[11px]" aria-hidden="true">
              {item.emoji}
            </span>
            <span
              className="text-[9px] md:text-[10px] tracking-[0.18em] uppercase font-medium"
              style={{
                color: 'rgba(30,24,20,0.72)',
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              {item.text}
            </span>
          </div>
        ))}
      </div>

      <div id="collection">
        <Suspense
          fallback={
            <div className="w-full py-32 md:py-48" style={{ backgroundColor: '#ffffff' }} />
          }
        >
          <ProductColorSection
            id="moi-wavvy"
            productPromise={wavvy}
            sectionTitle="MOI WAVVY"
            sectionSubtitle="The ultimate throw-and-go. Light, breathable, and made for drifting."
            colors={WAVVY_COLORS}
            background="#ffffff"
          />
        </Suspense>
      </div>

      <EditorialStrip />

      <Suspense
        fallback={
          <div className="w-full py-32 md:py-48" style={{ backgroundColor: '#f0ece6' }} />
        }
      >
        <ProductColorSection
          id="moi-versa-top"
          productPromise={versa}
          sectionTitle="MOI VERSA TOP"
          sectionSubtitle="Effortlessly versatile. A silhouette that moves with you, in every shade of summer."
          colors={VERSA_COLORS}
          background="#f0ece6"
        />
      </Suspense>

      <Footer />
    </div>
  );
}

const PRODUCT_BY_HANDLE_QUERY = `#graphql
  query ProductByHandle($handle: String!) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;
