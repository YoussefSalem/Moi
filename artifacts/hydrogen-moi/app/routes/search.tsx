import { defer, type LoaderFunctionArgs } from '@shopify/remix-oxygen';
import { useLoaderData, useSearchParams, type MetaFunction } from '@remix-run/react';
import { Image } from '@shopify/hydrogen';
import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { formatShopifyPrice } from '~/lib/price';
import { Footer } from '~/components/Footer';

export const meta: MetaFunction = () => [
  { title: 'Search — Moi' },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { storefront } = context;
  const url = new URL(request.url);
  const searchTerm = url.searchParams.get('q') ?? '';

  if (!searchTerm) {
    return defer({ results: null, searchTerm });
  }

  const resultsPromise = storefront.query(SEARCH_QUERY, {
    variables: {
      query: searchTerm,
      first: 20,
    },
    cache: storefront.CacheShort(),
  });

  return defer({ results: resultsPromise, searchTerm });
}

export default function SearchPage() {
  const { results, searchTerm } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(searchTerm);

  return (
    <div style={{ backgroundColor: '#faf8f5', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-6 pt-28 pb-16">
        {/* Search input */}
        <div className="relative mb-12">
          <Search
            size={18}
            strokeWidth={1.5}
            className="absolute left-0 top-1/2 -translate-y-1/2"
            style={{ color: '#7a6e64' }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setParams({ q: query });
              }
            }}
            placeholder="Search products…"
            className="w-full pl-8 pb-3 bg-transparent border-b outline-none text-lg"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              borderColor: 'rgba(30,24,20,0.15)',
              color: '#1e1814',
              letterSpacing: '0.04em',
            }}
            autoFocus
          />
        </div>

        {/* Results */}
        {results && (
          <SearchResults results={results} />
        )}

        {!results && !searchTerm && (
          <p
            className="text-center text-sm tracking-[0.2em] uppercase"
            style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}
          >
            Start typing to search
          </p>
        )}
      </div>
      <Footer />
    </div>
  );
}

function SearchResults({ results }: { results: Promise<unknown> | unknown }) {
  const [resolved, setResolved] = useState<{
    products: { nodes: Array<{
      id: string;
      handle: string;
      title: string;
      featuredImage: { url: string; altText: string | null } | null;
      priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
      options: Array<{ name: string; values: string[] }>;
    }> };
  } | null>(null);

  useEffect(() => {
    if (results instanceof Promise) {
      results.then((r) => setResolved(r as typeof resolved));
    } else {
      setResolved(results as typeof resolved);
    }
  }, [results]);

  if (!resolved) {
    return (
      <div className="flex justify-center py-12">
        <div
          className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: '#1e1814', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const products = resolved?.products?.nodes ?? [];

  if (products.length === 0) {
    return (
      <p
        className="text-center text-sm tracking-[0.2em] uppercase"
        style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}
      >
        No results found
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {products.map((product) => (
        <a key={product.id} href={`/products/${product.handle}`} className="group">
          <div
            className="aspect-[3/4] overflow-hidden rounded-lg mb-3"
            style={{ backgroundColor: '#f5f0ec' }}
          >
            {product.featuredImage ? (
              <img
                src={product.featuredImage.url}
                alt={product.featuredImage.altText ?? product.title}
                className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span
                  className="text-xs tracking-wider uppercase"
                  style={{ color: '#b0a090', fontFamily: "'Montserrat', sans-serif" }}
                >
                  No image
                </span>
              </div>
            )}
          </div>
          <p
            className="text-sm mb-1"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              color: '#1e1814',
              letterSpacing: '0.04em',
            }}
          >
            {product.title}
          </p>
          <p
            className="text-xs tracking-[0.1em]"
            style={{ fontFamily: "'Montserrat', sans-serif", color: '#7a6e64' }}
          >
            {formatShopifyPrice(product.priceRange.minVariantPrice)}
          </p>
        </a>
      ))}
    </div>
  );
}

const SEARCH_QUERY = `#graphql
  query Search($query: String!, $first: Int!) {
    products(query: $query, first: $first) {
      nodes {
        id
        handle
        title
        featuredImage {
          url
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        options {
          name
          values
        }
      }
    }
  }
` as const;
