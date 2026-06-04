import {
  defer,
  redirect,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from '@shopify/remix-oxygen';
import {
  useLoaderData,
  Await,
  useNavigate,
  type MetaFunction,
} from '@remix-run/react';
import { CartForm, Image } from '@shopify/hydrogen';
import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { PRODUCT_FRAGMENT } from '~/lib/fragments';
import { formatShopifyPrice, parseEGP } from '~/lib/price';
import { slugify, colorToSlug, getSwatchColor } from '~/lib/utils';
import { ImageSkeleton } from '~/components/ImageSkeleton';
import { CinematicLightbox } from '~/components/CinematicLightbox';
import { Footer } from '~/components/Footer';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.product) return [{ title: 'Product — Moi' }];
  const { product } = data;
  return [
    { title: `${product.title} — Moi` },
    {
      name: 'description',
      content: product.description?.slice(0, 160) ?? '',
    },
    { property: 'og:title', content: `${product.title} — Moi` },
    { property: 'og:description', content: product.description?.slice(0, 160) ?? '' },
    {
      property: 'og:image',
      content: product.featuredImage?.url ?? '',
    },
  ];
};

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { handle } = params;
  if (!handle) throw new Response('Not found', { status: 404 });

  const { storefront } = context;

  // Normalize handle: the URL may be "moi-wavvy-light-blue" — we need to try
  // the base product handle first.
  const baseHandles = ['moi-wavvy', 'moi-versa-top', 'trio-bangles'];
  const matchedBase = baseHandles.find(
    (b) => handle === b || handle.startsWith(b + '-'),
  );

  const productHandle = matchedBase ?? handle;
  const colorSlug = matchedBase && handle !== matchedBase
    ? handle.slice(matchedBase.length + 1)
    : null;

  const { product } = await storefront.query(PRODUCT_QUERY, {
    variables: { handle: productHandle },
    cache: storefront.CacheShort(),
  });

  if (!product) throw new Response('Not found', { status: 404 });

  // Determine the initial color from the URL slug
  const initialColor = colorSlug
    ? product.options
        .find((o: {name: string; values: string[]}) => o.name.toLowerCase() === 'color')
        ?.values.find((v: string) => slugify(v) === colorSlug) ?? null
    : null;

  // Recommended products (same collection)
  const recommendedPromise = storefront.query(RECOMMENDED_PRODUCTS_QUERY, {
    variables: { productId: product.id },
    cache: storefront.CacheLong(),
  });

  return defer({
    product,
    initialColor,
    colorSlug,
    productHandle,
    recommended: recommendedPromise,
  });
}

export default function ProductPage() {
  const { product, initialColor, colorSlug, productHandle } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const allImages = product.images?.nodes ?? [];
  const variants = product.variants?.nodes ?? [];
  const colorOption = product.options?.find(
    (o: {name: string; values: string[]}) => o.name.toLowerCase() === 'color',
  );
  const sizeOption = product.options?.find(
    (o: {name: string; values: string[]}) => o.name.toLowerCase() === 'size',
  );

  const [selectedColor, setSelectedColor] = useState<string>(
    initialColor ?? colorOption?.values[0] ?? '',
  );
  const [selectedSize, setSelectedSize] = useState<string>(
    sizeOption?.values[0] ?? '',
  );
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);

  // Find active variant
  const activeVariant = variants.find((v: {selectedOptions: {name: string; value: string}[]}) => {
    const colorMatch = !colorOption || v.selectedOptions.some(
      (o) => o.name.toLowerCase() === 'color' && o.value === selectedColor,
    );
    const sizeMatch = !sizeOption || v.selectedOptions.some(
      (o) => o.name.toLowerCase() === 'size' && o.value === selectedSize,
    );
    return colorMatch && sizeMatch;
  }) ?? variants[0];

  // Get images for active color
  const colorImages = allImages.filter((img: {altText: string | null; url: string}) => {
    if (!img.altText) return true;
    return img.altText.toLowerCase().includes(selectedColor.toLowerCase());
  });
  const displayImages = colorImages.length > 0 ? colorImages : allImages;

  useEffect(() => {
    setGalleryIndex(0);
    setImgLoaded(false);
  }, [selectedColor]);

  // Update URL when color changes
  useEffect(() => {
    if (!selectedColor) return;
    const newHandle = `${productHandle}-${colorToSlug(selectedColor)}`;
    const newUrl = `/products/${newHandle}`;
    const currentPath = window.location.pathname;
    if (currentPath !== newUrl) {
      window.history.replaceState(null, '', newUrl);
    }
  }, [selectedColor, productHandle]);

  const currentImg = displayImages[galleryIndex];
  const price = formatShopifyPrice(activeVariant?.price);
  const compareAtPrice = activeVariant?.compareAtPrice
    ? formatShopifyPrice(activeVariant.compareAtPrice)
    : null;
  const inStock = activeVariant?.availableForSale ?? false;

  const galleryUrls = displayImages.map((img: {url: string}) => img.url);

  return (
    <div style={{ backgroundColor: '#faf8f5', minHeight: '100vh' }}>
      {/* Back button */}
      <div className="px-6 pt-24 pb-0">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-xs tracking-[0.18em] uppercase transition-opacity hover:opacity-60"
          style={{
            fontFamily: "'Montserrat', sans-serif",
            color: '#1e1814',
          }}
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          Back
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
          {/* Gallery */}
          <div className="relative">
            {/* Main image */}
            <div
              className="relative aspect-[3/4] overflow-hidden rounded-xl cursor-pointer"
              style={{ backgroundColor: '#f5f0ec' }}
              onClick={() => setLightboxOpen(true)}
            >
              {!imgLoaded && <ImageSkeleton variant="warm" />}
              {currentImg && (
                <img
                  key={currentImg.url}
                  src={currentImg.url}
                  alt={currentImg.altText ?? product.title}
                  className="absolute inset-0 w-full h-full object-cover object-top"
                  style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.4s ease' }}
                  onLoad={() => setImgLoaded(true)}
                />
              )}

              {/* Nav arrows */}
              {displayImages.length > 1 && (
                <>
                  <button
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm transition-opacity hover:opacity-100 opacity-60"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGalleryIndex(
                        (i) => (i - 1 + displayImages.length) % displayImages.length,
                      );
                    }}
                  >
                    <ChevronLeft size={16} strokeWidth={1.5} />
                  </button>
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm transition-opacity hover:opacity-100 opacity-60"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGalleryIndex((i) => (i + 1) % displayImages.length);
                    }}
                  >
                    <ChevronRight size={16} strokeWidth={1.5} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {displayImages.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
                {displayImages.map((img: {url: string; altText: string | null}, i: number) => (
                  <button
                    key={img.url}
                    onClick={() => setGalleryIndex(i)}
                    className="flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden transition-all"
                    style={{
                      outline: i === galleryIndex ? '2px solid #1e1814' : '2px solid transparent',
                      outlineOffset: '2px',
                    }}
                  >
                    <img
                      src={img.url}
                      alt={img.altText ?? `View ${i + 1}`}
                      className="w-full h-full object-cover object-top"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="flex flex-col">
            {/* Title */}
            <div className="mb-6">
              {colorOption && selectedColor && (
                <p
                  className="text-[10px] tracking-[0.35em] uppercase mb-2"
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    color: '#b0a090',
                  }}
                >
                  {selectedColor}
                </p>
              )}
              <h1
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
                  fontWeight: 300,
                  color: '#1e1814',
                  letterSpacing: '0.05em',
                  lineHeight: 1.1,
                }}
              >
                {product.title}
              </h1>
            </div>

            {/* Price */}
            <div className="flex items-center gap-3 mb-8">
              {compareAtPrice && (
                <span
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: '0.9rem',
                    color: '#8a7e74',
                    textDecoration: 'line-through',
                    textDecorationColor: '#c83232',
                    textDecorationThickness: 1,
                  }}
                >
                  {compareAtPrice}
                </span>
              )}
              <span
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: '1.05rem',
                  letterSpacing: '0.1em',
                  color: compareAtPrice ? '#c83232' : '#1e1814',
                  fontWeight: 500,
                }}
              >
                {price}
              </span>
              {compareAtPrice && (
                <span
                  className="text-[9px] tracking-[0.15em] uppercase px-2 py-1"
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    backgroundColor: 'rgba(200,50,50,0.08)',
                    color: '#c83232',
                    border: '1px solid rgba(200,50,50,0.2)',
                  }}
                >
                  Sale
                </span>
              )}
            </div>

            {/* Color selector */}
            {colorOption && (
              <div className="mb-6">
                <p
                  className="text-[10px] tracking-[0.3em] uppercase mb-3"
                  style={{ fontFamily: "'Montserrat', sans-serif", color: '#7a6e64' }}
                >
                  Color — {selectedColor}
                </p>
                <div className="flex flex-wrap gap-2">
                  {colorOption.values.map((color: string) => {
                    const swatch = getSwatchColor(color);
                    const colorVariant = variants.find((v: {selectedOptions: {name: string; value: string}[]}) =>
                      v.selectedOptions.some(
                        (o) => o.name.toLowerCase() === 'color' && o.value === color,
                      ),
                    );
                    const isOOS = colorVariant ? !colorVariant.availableForSale : false;
                    const isSelected = color === selectedColor;

                    return (
                      <button
                        key={color}
                        onClick={() => {
                          setSelectedColor(color);
                          if (sizeOption) setSelectedSize(sizeOption.values[0] ?? '');
                        }}
                        title={color}
                        className="relative w-9 h-9 rounded-full transition-all"
                        style={{
                          backgroundColor: swatch ?? '#d4c4b0',
                          border: isSelected
                            ? '2px solid #1e1814'
                            : '2px solid rgba(30,24,20,0.15)',
                          boxShadow: isSelected ? '0 0 0 2px rgba(30,24,20,0.15)' : 'none',
                          opacity: isOOS ? 0.4 : 1,
                        }}
                      >
                        {isOOS && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span
                              className="block w-full h-px"
                              style={{
                                backgroundColor: '#1e1814',
                                transform: 'rotate(-45deg)',
                              }}
                            />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size selector */}
            {sizeOption && (
              <div className="mb-8">
                <p
                  className="text-[10px] tracking-[0.3em] uppercase mb-3"
                  style={{ fontFamily: "'Montserrat', sans-serif", color: '#7a6e64' }}
                >
                  Size — {selectedSize}
                </p>
                <div className="flex flex-wrap gap-2">
                  {sizeOption.values.map((size: string) => {
                    const sizeVariant = variants.find((v: {selectedOptions: {name: string; value: string}[]}) =>
                      v.selectedOptions.some(
                        (o) => o.name.toLowerCase() === 'color' && o.value === selectedColor,
                      ) &&
                      v.selectedOptions.some(
                        (o) => o.name.toLowerCase() === 'size' && o.value === size,
                      ),
                    );
                    const isOOS = sizeVariant ? !sizeVariant.availableForSale : false;
                    const isSelected = size === selectedSize;

                    return (
                      <button
                        key={size}
                        onClick={() => !isOOS && setSelectedSize(size)}
                        disabled={isOOS}
                        className="px-4 py-2 text-xs tracking-[0.2em] uppercase transition-all"
                        style={{
                          fontFamily: "'Montserrat', sans-serif",
                          border: isSelected
                            ? '1px solid #1e1814'
                            : '1px solid rgba(30,24,20,0.25)',
                          color: isSelected ? '#fff' : '#1e1814',
                          backgroundColor: isSelected ? '#1e1814' : 'transparent',
                          opacity: isOOS ? 0.4 : 1,
                          cursor: isOOS ? 'not-allowed' : 'pointer',
                          textDecoration: isOOS ? 'line-through' : 'none',
                        }}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add to cart */}
            <div className="flex flex-col gap-3 mb-8">
              {inStock ? (
                <CartForm
                  route="/cart"
                  action={CartForm.ACTIONS.LinesAdd}
                  inputs={{
                    lines: [
                      {
                        merchandiseId: activeVariant?.id,
                        quantity: 1,
                      },
                    ],
                  }}
                >
                  <button
                    type="submit"
                    className="w-full py-4 text-xs tracking-[0.4em] uppercase transition-all hover:opacity-85 active:scale-[0.98]"
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 500,
                      backgroundColor: '#1e1814',
                      color: '#faf8f5',
                      border: '1px solid #1e1814',
                    }}
                    onClick={() => {
                      setAddedFeedback(true);
                      toast.success('Added to cart');
                      setTimeout(() => setAddedFeedback(false), 2000);
                    }}
                  >
                    {addedFeedback ? '✓ Added' : 'Add to Cart'}
                  </button>
                </CartForm>
              ) : (
                <button
                  disabled
                  className="w-full py-4 text-xs tracking-[0.4em] uppercase cursor-not-allowed"
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 500,
                    backgroundColor: '#f0ece8',
                    color: '#a89e97',
                    border: '1px solid #c8bfb8',
                  }}
                >
                  Sold Out
                </button>
              )}
            </div>

            {/* Description */}
            <div className="mb-8 border-t border-stone-200 pt-6">
              <p
                className="text-sm leading-7"
                style={{ color: '#7a6e64' }}
              >
                {product.description}
              </p>
            </div>

            {/* Details accordion */}
            <div className="border-t border-stone-200 pt-6 space-y-4">
              <p
                className="text-[10px] tracking-[0.35em] uppercase"
                style={{ fontFamily: "'Montserrat', sans-serif", color: '#b0a090' }}
              >
                Product Details
              </p>
              <div className="space-y-2">
                {product.tags?.map((tag: string) => (
                  <p key={tag} className="text-xs" style={{ color: '#7a6e64' }}>
                    {tag}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CinematicLightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={galleryUrls}
        initialIndex={galleryIndex}
        productName={product.title}
      />

      <Footer />
    </div>
  );
}

const PRODUCT_QUERY = `#graphql
  query Product($handle: String!) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  query RecommendedProducts($productId: ID!) {
    productRecommendations(productId: $productId) {
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
    }
  }
` as const;
