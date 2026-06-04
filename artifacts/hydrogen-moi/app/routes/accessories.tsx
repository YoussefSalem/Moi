import { Suspense, useState, useEffect } from 'react';
import { defer, type LoaderFunctionArgs } from '@shopify/remix-oxygen';
import { useLoaderData, Await, type MetaFunction } from '@remix-run/react';
import { motion } from 'framer-motion';
import { CartForm } from '@shopify/hydrogen';
import { toast } from 'sonner';
import { formatShopifyPrice } from '~/lib/price';
import { Footer } from '~/components/Footer';

export const meta: MetaFunction = () => [
  { title: 'Accessories — Moi' },
  {
    name: 'description',
    content: 'Shop Moi accessories — elegant curated pieces to complete every look.',
  },
];

interface AccessoryProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
  featuredImage: { url: string; altText: string | null } | null;
  variants: {
    nodes: Array<{
      id: string;
      availableForSale: boolean;
      price: { amount: string; currencyCode: string };
    }>;
  };
}

interface AccessoriesData {
  collection: { products: { nodes: AccessoryProduct[] } } | null;
}

export async function loader({ context }: LoaderFunctionArgs) {
  const { storefront } = context;

  const accessoriesPromise = storefront.query(ACCESSORIES_QUERY, {
    cache: storefront.CacheLong(),
  });

  return defer({ accessories: accessoriesPromise });
}

export default function AccessoriesPage() {
  const { accessories } = useLoaderData<typeof loader>();

  return (
    <div style={{ backgroundColor: '#1a1410', minHeight: '100vh' }}>
      {/* Hero */}
      <div
        className="relative flex flex-col items-center justify-center text-center px-6"
        style={{
          paddingTop: 'clamp(120px, 20vw, 200px)',
          paddingBottom: 'clamp(60px, 10vw, 100px)',
        }}
      >
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-[9px] tracking-[0.55em] uppercase mb-4"
          style={{ color: 'rgba(200,185,165,0.55)', fontFamily: "'Montserrat', sans-serif" }}
        >
          Curated Collection
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(3rem, 10vw, 7rem)',
            fontWeight: 300,
            color: '#fff',
            letterSpacing: '0.06em',
            lineHeight: 0.95,
          }}
        >
          Accessories
        </motion.h1>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="mt-8"
          style={{
            width: 48,
            height: 1,
            backgroundColor: 'rgba(200,185,165,0.3)',
          }}
        />
      </div>

      {/* Products grid */}
      <div className="max-w-6xl mx-auto px-6 md:px-12 pb-24">
        <Suspense
          fallback={
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-10">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-xl"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                />
              ))}
            </div>
          }
        >
          <Await resolve={accessories}>
            {(data) => {
              const products = (data as AccessoriesData).collection?.products?.nodes ?? [];

              if (products.length === 0) {
                return (
                  <p
                    className="text-center py-16 text-sm tracking-[0.25em] uppercase"
                    style={{
                      color: 'rgba(200,185,165,0.45)',
                      fontFamily: "'Montserrat', sans-serif",
                    }}
                  >
                    Coming soon
                  </p>
                );
              }

              return (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-10">
                  {products.map((product, i) => {
                    const variant = product.variants.nodes[0];
                    const price = variant ? formatShopifyPrice(variant.price) : '';
                    const inStock = variant?.availableForSale ?? false;

                    return (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-40px' }}
                        transition={{
                          duration: 0.6,
                          ease: [0.22, 1, 0.36, 1],
                          delay: i * 0.08,
                        }}
                      >
                        <a href={`/products/${product.handle}`} className="group block">
                          <div
                            className="aspect-[3/4] rounded-xl overflow-hidden mb-4"
                            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                          >
                            {product.featuredImage && (
                              <img
                                src={product.featuredImage.url}
                                alt={product.featuredImage.altText ?? product.title}
                                className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
                                loading="lazy"
                              />
                            )}
                          </div>
                          <p
                            className="text-lg mb-1"
                            style={{
                              fontFamily: "'Cormorant Garamond', Georgia, serif",
                              color: 'rgba(255,255,255,0.85)',
                              letterSpacing: '0.04em',
                              fontWeight: 300,
                            }}
                          >
                            {product.title}
                          </p>
                          <p
                            className="text-xs tracking-[0.14em]"
                            style={{
                              fontFamily: "'Montserrat', sans-serif",
                              color: 'rgba(200,185,165,0.6)',
                            }}
                          >
                            {price}
                          </p>
                        </a>

                        {inStock && variant && (
                          <CartForm
                            route="/cart"
                            action={CartForm.ACTIONS.LinesAdd}
                            inputs={{
                              lines: [{ merchandiseId: variant.id, quantity: 1 }],
                            }}
                          >
                            <button
                              type="submit"
                              className="mt-3 w-full py-3 text-[9px] tracking-[0.35em] uppercase transition-colors"
                              style={{
                                fontFamily: "'Montserrat', sans-serif",
                                border: '1px solid rgba(255,255,255,0.25)',
                                color: 'rgba(255,255,255,0.7)',
                                backgroundColor: 'transparent',
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                  'rgba(255,255,255,0.08)';
                                (e.currentTarget as HTMLButtonElement).style.color = '#fff';
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                  'transparent';
                                (e.currentTarget as HTMLButtonElement).style.color =
                                  'rgba(255,255,255,0.7)';
                              }}
                              onClick={() => toast.success('Added to cart')}
                            >
                              Add to Cart
                            </button>
                          </CartForm>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              );
            }}
          </Await>
        </Suspense>
      </div>

      <Footer />
    </div>
  );
}

const ACCESSORIES_QUERY = `#graphql
  query AccessoriesCollection {
    collection(handle: "accessories") {
      products(first: 20) {
        nodes {
          id
          handle
          title
          description
          featuredImage {
            url
            altText
          }
          variants(first: 5) {
            nodes {
              id
              availableForSale
              price {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
` as const;
