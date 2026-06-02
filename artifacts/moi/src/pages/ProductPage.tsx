import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowLeft, Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useShopifyProductByHandle } from "@/hooks/useShopifyProductByHandle";
import { parseEGP } from "@/lib/price";
import { useCart } from "@/context/CartContext";
import { useCustomer } from "@/context/CustomerContext";
import { IMAGES, type ProductConfig } from "@/config/images";
import { NotifyMeModal } from "@/components/NotifyMeModal";
import { CinematicLightbox } from "@/components/CinematicLightbox";
import { ImageSkeleton } from "@/components/ImageSkeleton";
import { trackAddToCart } from "@/lib/analytics";
import { trackViewContent } from "@/lib/metaPixel";
import { trackTikTokViewContent } from "@/lib/tiktokPixel";
import { getStockCount } from "@/lib/stock";

function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function deriveFallbackFromHandle(handle: string): ProductConfig {
  const allProducts = [IMAGES.product1, IMAGES.product2, IMAGES.product3];
  const matched = allProducts.find(
    (p) => handle.startsWith(p.slug + "-") || handle === p.slug,
  );
  if (!matched) return IMAGES.product1;

  const colorSlug = handle.startsWith(matched.slug + "-")
    ? handle.slice(matched.slug.length + 1)
    : "";

  const colorNames = Object.keys(matched.colorImages ?? {});
  const colorName =
    colorNames.find((c) => slugify(c) === colorSlug) ??
    colorNames[0] ??
    "White";

  const colorImagesMap = (matched.colorImages ?? {}) as unknown as Record<string, string>;
  const colorGalleriesMap = (matched.colorGalleries ?? {}) as unknown as Record<string, string[]>;
  const mainImage: string = colorImagesMap[colorName] ?? matched.productShot;
  const gallery: string[] = (colorGalleriesMap[colorName] as string[] | undefined) ?? [mainImage];

  const allVariants = (matched as unknown as { variants?: Array<{ id: string; availableForSale: boolean; selectedOptions: Array<{ name: string; value: string }>; price?: string; compareAtPrice?: string }> }).variants;
  const filteredVariants = allVariants?.filter((v) =>
    v.selectedOptions.some(
      (o) => o.name.toLowerCase() === "color" && slugify(o.value) === colorSlug,
    ),
  );
  const resolvedVariants = filteredVariants?.length ? filteredVariants : allVariants;

  return {
    ...(matched as unknown as ProductConfig),
    name: colorSlug ? `${matched.name} — ${colorName}` : matched.name,
    productShot: mainImage,
    filmstrip: gallery,
    variants: resolvedVariants,
  } as ProductConfig;
}

interface ProductPageProps {
  handle: string;
  onBack: () => void;
  onNavigate?: (handle: string) => void;
}

export function ProductPage({ handle, onBack, onNavigate }: ProductPageProps) {
  const fallback = deriveFallbackFromHandle(handle);
  const { product, loading } = useShopifyProductByHandle(handle, fallback);
  // When Shopify returns all variants for the base product (e.g. all MOI WAVVY colors),
  // we need to filter to the color in the URL. Extract from fallback.name which is
  // e.g. "MOI WAVVY — Light Blue" (set by deriveFallbackFromHandle).
  const pageColorName = fallback.name.includes(" — ")
    ? (fallback.name.split(" — ").pop() ?? "")
    : "";
  const { addToCart, clearCart, openCheckout } = useCart();
  const { customer } = useCustomer();
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState<boolean[]>([]);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const recsRef = useRef<HTMLDivElement>(null);

  // Persistent stock indicator for all products
  const stockCount = useMemo(() => {
    const color = pageColorName || product.name;
    return getStockCount(handle.split("-")[0] ?? "", color);
  }, [handle, pageColorName, product.name]);

  // SEO: update document head imperatively so meta is reliably in the <head>
  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${product.name} — Moi`;
    let descTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prevDesc = descTag?.content ?? "";
    if (!descTag) {
      descTag = document.createElement("meta");
      descTag.name = "description";
      document.head.appendChild(descTag);
    }
    descTag.content = product.description?.slice(0, 160) ?? "";
    return () => {
      document.title = prevTitle;
      if (descTag) descTag.content = prevDesc;
    };
  }, [product.name, product.description]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }, [handle]);
  useEffect(() => { setGalleryIndex(0); setImgLoaded(false); }, [handle]);

  // Meta Pixel + TikTok Pixel ViewContent — fires once per product page load
  useEffect(() => {
    const priceNum = parseEGP(product.price ?? "");
    const variantId = product.variantId ?? product.variants?.[0]?.id;
    trackViewContent({
      content_name: product.name,
      content_type: "product",
      content_ids: variantId ? [variantId] : undefined,
      currency: "EGP",
      value: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : undefined,
    });
    trackTikTokViewContent({
      content_name: product.name,
      content_type: "product",
      content_id: variantId,
      currency: "EGP",
      value: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : undefined,
    });
  }, [handle]);

  const sizeOption = product.variants
    ? (() => {
        const opt = product.variants[0]?.selectedOptions.find(
          (o) => o.name.toLowerCase() === "size" || o.name.toLowerCase() === "titre",
        );
        if (!opt) return null;
        const vals = [
          ...new Set(
            product.variants.map(
              (v) => v.selectedOptions.find((o) => o.name.toLowerCase() === opt.name.toLowerCase())?.value,
            ).filter(Boolean),
          ),
        ] as string[];
        return { optionName: opt.name, values: vals };
      })()
    : null;

  const displaySizes = sizeOption?.values.filter(
    (s) => !["one size", "os", "default title", "one-size"].includes(s.toLowerCase()),
  ) ?? [];

  const [selectedSize, setSelectedSize] = useState(() => displaySizes[0] ?? "");
  useEffect(() => { if (displaySizes[0]) setSelectedSize(displaySizes[0]); }, [product.slug]);

  const galleryImages: string[] = (() => {
    const film = product.filmstrip as string[];
    const raw = film?.length > 0 ? [product.productShot, ...film] : [product.productShot];
    return Array.from(new Set(raw));
  })();

  useEffect(() => { setThumbLoaded(new Array(galleryImages.length).fill(false)); }, [galleryImages.length, handle]);

  const mainImage = galleryImages[galleryIndex] ?? product.productShot;

  const prevImg = useCallback(() => setGalleryIndex((i) => (i - 1 + galleryImages.length) % galleryImages.length), [galleryImages.length]);
  const nextImg = useCallback(() => setGalleryIndex((i) => (i + 1) % galleryImages.length), [galleryImages.length]);

  const dragStartXRef = useRef<number | null>(null);
  const dragLastXRef = useRef<number | null>(null);

  const selectedVariant = product.variants?.find((v) => {
    const colorMatch = !pageColorName || v.selectedOptions.some(
      (o) => o.name.toLowerCase() === "color" && o.value === pageColorName,
    );
    const sizeMatch = !sizeOption || v.selectedOptions.some(
      (o) => o.name.toLowerCase() === sizeOption.optionName.toLowerCase() && o.value === selectedSize,
    );
    return colorMatch && sizeMatch;
  }) ?? product.variants?.find((v) =>
    !pageColorName || v.selectedOptions.some(
      (o) => o.name.toLowerCase() === "color" && o.value === pageColorName,
    ),
  ) ?? product.variants?.[0];

  const isOutOfStock = selectedVariant ? !selectedVariant.availableForSale : false;
  const effectivePrice = selectedVariant?.price ?? product.price;
  const effectiveCompareAtPrice = selectedVariant?.compareAtPrice ?? (product as unknown as { compareAtPrice?: string }).compareAtPrice;

  const handleAddToCart = async () => {
    if (isOutOfStock) return;
    trackAddToCart(
      selectedVariant?.id ?? product.variantId ?? "",
      product.name,
      1,
      parseEGP(String(effectivePrice)) || 0,
    );
    await addToCart({
      variantId: selectedVariant?.id ?? product.variantId ?? "",
      title: product.name,
      price: effectivePrice,
      priceAmount: parseEGP(String(effectivePrice)),
      compareAtPrice: effectiveCompareAtPrice,
      currencyCode: "EGP",
      image: galleryImages[0] ?? product.productShot,
      size: selectedSize || "One Size",
      color: product.name,
    });
    toast.success(`${product.name} added to bag`, { duration: 2500 });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const handleBuyNow = async () => {
    if (isOutOfStock) return;
    clearCart();
    trackAddToCart(
      selectedVariant?.id ?? product.variantId ?? "",
      product.name,
      1,
      parseEGP(String(effectivePrice)) || 0,
    );
    await addToCart({
      variantId: selectedVariant?.id ?? product.variantId ?? "",
      title: product.name,
      price: effectivePrice,
      priceAmount: parseEGP(String(effectivePrice)),
      compareAtPrice: effectiveCompareAtPrice,
      currencyCode: "EGP",
      image: galleryImages[0] ?? product.productShot,
      size: selectedSize || "One Size",
      color: product.name,
    });
    openCheckout();
  };

  const handleBuyWithApplePay = () => {
    if (isOutOfStock) return;

    const variantId = selectedVariant?.id ?? product.variantId ?? "";
    const priceAmount = parseEGP(String(effectivePrice)) || 0;
    const totalAmountCents = Math.round(priceAmount * 100) + 5000;
    const estimatedTotal = (totalAmountCents / 100).toFixed(2);

    trackAddToCart(variantId, product.name, 1, priceAmount);

    type APS = {
      begin(): void;
      abort(): void;
      completeMerchantValidation(ms: unknown): void;
      completePayment(status: number): void;
      onvalidatemerchant: ((e: { validationURL: string }) => void) | null;
      onpaymentauthorized: ((e: {
        payment: {
          token: { paymentData: unknown };
          shippingContact?: {
            givenName?: string; familyName?: string; emailAddress?: string;
            phoneNumber?: string; addressLines?: string[]; locality?: string;
            administrativeArea?: string;
          };
        };
      }) => void) | null;
      oncancel: (() => void) | null;
    };
    const W = window as unknown as {
      ApplePaySession: { new(v: number, r: object): APS; STATUS_SUCCESS: number; STATUS_FAILURE: number };
    };

    const session = new W.ApplePaySession(3, {
      countryCode: "EG",
      currencyCode: "EGP",
      supportedNetworks: ["visa", "masterCard"],
      merchantCapabilities: ["supports3DS"],
      total: { label: "Moi", amount: estimatedTotal, type: "final" },
      requiredShippingContactFields: ["email", "phone", "name"],
    });

    let intentId: string | null = null;
    let paymobPaymentKey: string | null = null;
    let finalTotal: string | null = estimatedTotal;

    session.onvalidatemerchant = async (event) => {
      try {
        clearCart();
        const res = await fetch("/api/apple-pay/validate-merchant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            validationURL: event.validationURL,
            lines: [{ variantId, quantity: 1 }],
            totalAmountCents,
          }),
        });
        if (!res.ok) { session.abort(); return; }
        const data = await res.json() as {
          merchantSession: unknown; intentId: string;
          paymobPaymentKey: string; total: string;
        };
        intentId = data.intentId;
        paymobPaymentKey = data.paymobPaymentKey;
        finalTotal = data.total;
        session.completeMerchantValidation(data.merchantSession);
      } catch {
        session.abort();
      }
    };

    session.onpaymentauthorized = async (event) => {
      try {
        const { payment } = event;
        const paymentData = JSON.stringify(payment.token.paymentData);
        const sc = payment.shippingContact;
        const shippingContact = {
          firstName: sc?.givenName?.trim() || "NA",
          lastName: sc?.familyName?.trim() || "NA",
          email: sc?.emailAddress?.trim() || "NA",
          phone: sc?.phoneNumber?.trim() || "NA",
          address: sc?.addressLines?.[0]?.trim() || "NA",
          city: sc?.locality?.trim() || "Cairo",
          governorate: sc?.administrativeArea?.trim() || "NA",
        };
        const res = await fetch("/api/apple-pay/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentData, intentId, paymobPaymentKey, shippingContact }),
        });
        const data = await res.json() as {
          success: boolean; txnId?: string;
          shopifyOrderId?: number; shopifyOrderNumber?: number;
          total?: string; error?: string;
        };
        if (data.success) {
          session.completePayment(W.ApplePaySession.STATUS_SUCCESS);
          sessionStorage.setItem("moi_apple_pay_result", JSON.stringify({
            txnId: data.txnId,
            shopifyOrderId: data.shopifyOrderId,
            shopifyOrderNumber: data.shopifyOrderNumber,
            total: data.total ?? finalTotal,
            intentId,
            items: [{
              title: product.name,
              variantTitle: selectedSize || null,
              quantity: 1,
              image: galleryImages[0] ?? product.productShot ?? null,
              price: String(effectivePrice),
            }],
          }));
          openCheckout();
        } else {
          session.completePayment(W.ApplePaySession.STATUS_FAILURE);
          toast.error(data.error ?? "Payment was declined. Please try another card.");
        }
      } catch {
        session.completePayment(W.ApplePaySession.STATUS_FAILURE);
      }
    };

    session.oncancel = () => {};
    session.begin();
  };

  const applePayAvailable =
    typeof window !== "undefined" &&
    "ApplePaySession" in window &&
    !!(window as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession?.canMakePayments?.();

  const subscribeToRestock = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const variantId = selectedVariant?.id ?? product.variantId ?? `${product.name}-fallback`;
    try {
      const res = await fetch("/api/restock/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, productHandle: handle, variantId, variantTitle: selectedSize || "One Size", productTitle: product.name }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      return json.success ? { success: true } : { success: false, error: json.error ?? "Something went wrong." };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const handleNotifyMe = async () => {
    if (customer?.email) {
      const result = await subscribeToRestock(customer.email);
      if (result.success) {
        toast.success("You're on the list.", { description: `We'll email you when it's back.`, duration: 3000 });
      } else {
        toast.error(result.error ?? "Could not subscribe.");
      }
    } else {
      setNotifyModalOpen(true);
    }
  };

  const BG = "#faf8f5";

  return (
    <>
      <div
        className="min-h-screen"
        style={{
          background: "radial-gradient(ellipse at 30% 20%, rgba(245,240,232,0.6) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(230,220,205,0.25) 0%, transparent 50%), #faf8f5",
        }}
      >
        {/* Back button — extra top padding to clear the fixed header (h-16 + safe-area) */}
        <div className="w-full px-5 md:px-12 pt-20 md:pt-24 pb-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 transition-opacity duration-200 hover:opacity-60"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 9,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "#8a7e74",
            }}
          >
            <ArrowLeft size={14} strokeWidth={1.4} />
            Back
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-6xl mx-auto px-5 md:px-12 pt-4 md:pt-6 pb-12 md:pb-16 flex flex-col md:grid md:grid-cols-2 gap-6 md:gap-10 md:items-start"
        >
            {/* ── IMAGE GALLERY ── */}
            <div className="w-full flex flex-col gap-3">
              {/* Image row: arrow | image | arrow */}
              <div className="flex items-center gap-4 justify-center">
                {/* Previous — minimal, outside image */}
                {galleryImages.length > 1 && (
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={(e) => { e.stopPropagation(); prevImg(); }}
                    className="hidden md:flex shrink-0 items-center justify-center text-[rgba(30,24,20,0.15)] hover:text-[rgba(30,24,20,0.55)] transition-colors duration-200"
                    style={{ width: 28, height: 60, background: "none", border: "none", cursor: "pointer" }}
                  >
                    <ChevronLeft size={22} strokeWidth={1} />
                  </button>
                )}

                {/* Main image — click opens lightbox zoom */}
                <div
                  className="relative flex-1 overflow-hidden rounded-sm cursor-pointer"
                  onClick={() => setLightboxOpen(true)}
                  onPointerDown={(e) => { dragStartXRef.current = e.clientX; dragLastXRef.current = e.clientX; }}
                  onPointerMove={(e) => { if (dragStartXRef.current !== null) dragLastXRef.current = e.clientX; }}
                  onPointerUp={(e) => {
                    const start = dragStartXRef.current;
                    if (start === null) return;
                    const delta = (dragLastXRef.current ?? e.clientX) - start;
                    dragStartXRef.current = null; dragLastXRef.current = null;
                    if (Math.abs(delta) > 40) { delta < 0 ? nextImg() : prevImg(); }
                  }}
                  onPointerLeave={() => { dragStartXRef.current = null; dragLastXRef.current = null; }}
                  style={{ touchAction: "pan-y", aspectRatio: "3/4", backgroundColor: "rgba(30,24,20,0.03)", userSelect: "none", WebkitUserSelect: "none" } as React.CSSProperties}
                >
                  <AnimatePresence initial={false} mode="wait">
                    <motion.img
                      key={mainImage}
                      src={mainImage}
                      alt={`${product.name}`}
                      className="absolute inset-0 w-full h-full"
                      style={{ objectFit: "contain", objectPosition: "center" }}
                      loading="eager"
                      decoding="async"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: imgLoaded ? 1 : 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      onLoad={() => setImgLoaded(true)}
                      onError={() => setImgLoaded(true)}
                    />
                  </AnimatePresence>
                  {!imgLoaded && (
                    <ImageSkeleton variant="warm" />
                  )}

                  {/* Zoom hint — mobile only */}
                  <div className="absolute bottom-3 right-3 md:hidden" style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8, color: "rgba(30,24,20,0.35)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                    tap to zoom
                  </div>
                </div>

                {/* Next — minimal, outside image */}
                {galleryImages.length > 1 && (
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={(e) => { e.stopPropagation(); nextImg(); }}
                    className="hidden md:flex shrink-0 items-center justify-center text-[rgba(30,24,20,0.15)] hover:text-[rgba(30,24,20,0.55)] transition-colors duration-200"
                    style={{ width: 28, height: 60, background: "none", border: "none", cursor: "pointer" }}
                  >
                    <ChevronRight size={22} strokeWidth={1} />
                  </button>
                )}
              </div>

              {/* Thumbnails — centered under image */}
              {galleryImages.length > 1 && (
                <div className="flex gap-2 flex-wrap justify-center">
                  {galleryImages.map((src, i) => (
                    <button
                      key={`${src}-${i}`}
                      type="button"
                      onClick={() => { setGalleryIndex(i); setImgLoaded(false); }}
                      className="overflow-hidden rounded-sm transition-all duration-200"
                      style={{
                        width: 64,
                        height: 80,
                        border: i === galleryIndex
                          ? "1.5px solid #1e1814"
                          : "1.5px solid rgba(30,24,20,0.12)",
                        flexShrink: 0,
                        opacity: i === galleryIndex ? 1 : 0.65,
                      }}
                    >
                      <div className="relative w-full h-full">
                        {/* Thumbnail image — hidden until loaded */}
                        <img
                          src={src}
                          alt={`View ${i + 1}`}
                          className="w-full h-full"
                          style={{ objectFit: "cover", opacity: thumbLoaded[i] ? 1 : 0 }}
                          loading="lazy"
                          onLoad={() => setThumbLoaded(prev => {
                            const next = [...prev];
                            next[i] = true;
                            return next;
                          })}
                          onError={() => setThumbLoaded(prev => {
                            const next = [...prev];
                            next[i] = true;
                            return next;
                          })}
                        />
                        {/* Circular spinner while loading */}
                        {!thumbLoaded[i] && (
                          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(30,24,20,0.04)]">
                            <Loader2
                              size={18}
                              strokeWidth={1.5}
                              className="animate-spin text-[rgba(30,24,20,0.3)]"
                              style={{ animationDuration: "1s" }}
                            />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── PRODUCT INFO ── */}
            <div className="flex flex-col pt-0 w-full">
              {/* Name */}
              <h1
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: "clamp(1.77rem, 7vw, 3.12rem)",
                  fontWeight: 300,
                  color: "#1e1814",
                  letterSpacing: "0.04em",
                  lineHeight: 1.1,
                  marginBottom: 8,
                }}
              >
                {product.name}
              </h1>

              {/* Stock count */}
              {stockCount && (
                <div className="mb-2" style={{ marginTop: -2 }}>
                  <span
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: 10,
                      color: "#c83232",
                      letterSpacing: "0.04em",
                      fontWeight: 500,
                    }}
                  >
                    Only {stockCount} left
                  </span>
                </div>
              )}

              {/* Price */}
              <div className="flex flex-col" style={{ marginBottom: 20, gap: 2 }}>
                {effectiveCompareAtPrice && (
                  <span
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "clamp(0.94rem, 2.6vw, 1.08rem)",
                      fontWeight: 400,
                      letterSpacing: "0.08em",
                      color: "#8a7e74",
                      textDecoration: "line-through",
                      textDecorationThickness: 1,
                      textDecorationColor: "#c83232",
                      lineHeight: 1.2,
                    }}
                  >
                    {effectiveCompareAtPrice}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <p
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "clamp(1.04rem, 3vw, 1.2rem)",
                      fontWeight: 500,
                      letterSpacing: "0.12em",
                      color: effectiveCompareAtPrice ? "#c83232" : "#1e1814",
                      lineHeight: 1.2,
                    }}
                  >
                    {effectivePrice}
                  </p>
                  {effectiveCompareAtPrice && (
                    <span
                      style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: "11px",
                        fontWeight: 500,
                        letterSpacing: "0.14em",
                        color: "#c83232",
                      }}
                    >
                      {(() => {
                        const p = parseEGP(String(effectivePrice));
                        const c = parseEGP(String(effectiveCompareAtPrice));
                        if (!p || !c || c <= p) return null;
                        return `Save ${Math.round((1 - p / c) * 100)}%`;
                      })()}
                    </span>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="w-10 mb-6" style={{ height: 1, backgroundColor: "rgba(180,160,140,0.4)" }} />

              {/* Description — bullets if available, otherwise plain text */}
              {"descriptionBullets" in (product as unknown as Record<string, unknown>) && (product as unknown as { descriptionBullets?: string[] }).descriptionBullets?.length ? (
                <ul className="mb-8 space-y-2" style={{ maxWidth: 400 }}>
                  {(product as unknown as { descriptionBullets: string[] }).descriptionBullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        className="flex-shrink-0 mt-2 rounded-full"
                        style={{
                          width: 6,
                          height: 6,
                          backgroundColor: "rgba(30,24,20,0.18)",
                          border: "1px solid rgba(30,24,20,0.2)",
                        }}
                      />
                      <span
                        className="leading-relaxed font-light"
                        style={{ color: "#6a5e56", fontSize: "clamp(0.85rem, 2.2vw, 0.94rem)", fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                      >
                        {bullet}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p
                  className="leading-relaxed font-light mb-8"
                  style={{ color: "#6a5e56", fontSize: "clamp(0.85rem, 2.2vw, 0.94rem)", maxWidth: 400 }}
                >
                  {product.description}
                </p>
              )}

              {/* Size selector */}
              {displaySizes.length > 1 && (
                <div className="flex flex-col gap-3 mb-8">
                  <p
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: 10,
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                      color: "#8a7e74",
                    }}
                  >
                    Size —{" "}
                    <span style={{ color: "#1e1814" }}>{selectedSize}</span>
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {displaySizes.map((size) => {
                      const available = product.variants?.some(
                        (v) => v.selectedOptions.some((o) => o.name.toLowerCase() === sizeOption?.optionName.toLowerCase() && o.value === size) && v.availableForSale,
                      ) ?? true;
                      const isSelected = selectedSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className="relative overflow-hidden border transition-all duration-300"
                          style={{
                            minWidth: 88,
                            padding: "9px 14px",
                            fontSize: 11,
                            letterSpacing: "0.22em",
                            textTransform: "uppercase",
                            fontFamily: "'Montserrat', sans-serif",
                            fontWeight: 500,
                            color: !available ? "rgba(30,24,20,0.36)" : isSelected ? "#1e1814" : "#5a4e44",
                            borderColor: isSelected ? "#1e1814" : "rgba(30,24,20,0.28)",
                            backgroundColor: isSelected ? "rgba(30,24,20,0.08)" : "rgba(250,248,245,0.8)",
                          }}
                        >
                          {!available && (
                            <span aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                              <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}>
                                <line x1="0" y1="100%" x2="100%" y2="0" stroke="rgba(30,24,20,0.18)" strokeWidth="1" />
                              </svg>
                            </span>
                          )}
                          {size}
                        </button>
                      );
                    })}
                  </div>
                  {selectedSize && (
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "11.5px", color: "rgba(90,78,68,0.78)", lineHeight: 1.7 }}>
                      {selectedSize.toLowerCase().includes("s") || selectedSize.toLowerCase().includes("m")
                        ? <><span style={{ color: "rgba(30,24,20,0.8)" }}>{selectedSize}</span> — a closer fit. Best for heights up to 1.65 m.</>
                        : <><span style={{ color: "rgba(30,24,20,0.8)" }}>{selectedSize}</span> — a relaxed fit. Best for heights 1.65 m and above.</>
                      }
                    </p>
                  )}
                </div>
              )}

              {/* One Size pill */}
              {displaySizes.length <= 1 && sizeOption && (
                <div className="mb-8">
                  <button
                    type="button"
                    disabled
                    style={{
                      padding: "11px 24px",
                      fontSize: 10,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 500,
                      color: "#1e1814",
                      border: "1px solid #1e1814",
                      backgroundColor: "rgba(30,24,20,0.04)",
                    }}
                  >
                    One Size
                  </button>
                </div>
              )}

              {/* CTA — wide, luxurious, generous padding */}
              {isOutOfStock ? (
                <motion.button
                  type="button"
                  onClick={handleNotifyMe}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 border transition-all duration-300 w-full md:w-auto"
                  style={{
                    padding: "18px 48px",
                    minWidth: 280,
                    maxWidth: 400,
                    fontSize: "clamp(0.73rem, 2.5vw, 0.83rem)",
                    letterSpacing: "0.32em",
                    textTransform: "uppercase",
                    fontFamily: "'Montserrat', sans-serif",
                    color: "#f5f0e8",
                    borderColor: "rgba(245,240,232,0.2)",
                    backgroundColor: "rgba(30,24,20,0.9)",
                    borderRadius: 6,
                  }}
                >
                  <Bell size={11} strokeWidth={1.8} />
                  Notify Me When Back
                </motion.button>
              ) : (
                <div className="flex flex-col gap-3 w-full md:w-auto">
                  <motion.button
                    type="button"
                    onClick={handleAddToCart}
                    whileTap={{ scale: 0.98 }}
                    className="border transition-all duration-500 w-full flex items-center justify-center"
                    style={{
                      padding: "16px 56px",
                      minWidth: 280,
                      maxWidth: 400,
                      fontSize: "clamp(0.73rem, 2.5vw, 0.83rem)",
                      letterSpacing: "0.32em",
                      textTransform: "uppercase",
                      fontFamily: "'Montserrat', sans-serif",
                      color: addedFeedback ? "#1e1814" : "#1e1814",
                      borderColor: "#1e1814",
                      backgroundColor: addedFeedback ? "rgba(30,24,20,0.06)" : "transparent",
                      borderRadius: 6,
                    }}
                  >
                    {addedFeedback ? "Added to Bag ✓" : "Add to Cart"}
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handleBuyNow}
                    whileTap={{ scale: 0.98 }}
                    className="border transition-all duration-500 w-full flex items-center justify-center"
                    style={{
                      padding: "18px 56px",
                      minWidth: 280,
                      maxWidth: 400,
                      fontSize: "clamp(0.73rem, 2.5vw, 0.83rem)",
                      letterSpacing: "0.32em",
                      textTransform: "uppercase",
                      fontFamily: "'Montserrat', sans-serif",
                      color: "#faf8f5",
                      borderColor: "#1e1814",
                      backgroundColor: "#1e1814",
                      boxShadow: "0 10px 32px rgba(30,24,20,0.18)",
                      borderRadius: 6,
                    }}
                  >
                    Buy It Now
                  </motion.button>

                  {/* Apple Pay quick-buy — only rendered on Apple Pay capable devices */}
                  {applePayAvailable && (
                    <motion.button
                      type="button"
                      onClick={handleBuyWithApplePay}
                      whileTap={{ scale: 0.98 }}
                      className="transition-all duration-300 w-full flex items-center justify-center gap-2"
                      disabled={isOutOfStock}
                      style={{
                        padding: "15px 40px",
                        minWidth: 280,
                        maxWidth: 400,
                        fontSize: "clamp(0.73rem, 2.5vw, 0.83rem)",
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        fontFamily: "'Montserrat', sans-serif",
                        color: "#1e1814",
                        border: "1.5px solid rgba(30,24,20,0.28)",
                        backgroundColor: "transparent",
                        borderRadius: 6,
                        opacity: isOutOfStock ? 0.4 : 1,
                      }}
                    >
                      <svg viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#1e1814" style={{ flexShrink: 0 }}>
                        <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.1-38.8-168.4-103.1c-73.9-71.9-134.6-183.3-134.6-290.9 0-195.3 129.4-298.5 256.8-298.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
                      </svg>
                      Pay
                    </motion.button>
                  )}
                </div>
              )}

              {/* You May Also Like — clothing recommendations */}
              {onNavigate && (
                <div className="mt-12 pt-10 border-t border-[rgba(30,24,20,0.08)]">
                  <p
                    className="text-center"
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "clamp(10px, 2.8vw, 11px)",
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                      color: "#8a7e74",
                      marginBottom: 20,
                    }}
                  >
                    You May Also Like
                  </p>
                  <div className="hidden md:flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Scroll left"
                      onClick={() => recsRef.current?.scrollBy({ left: -140, behavior: "smooth" })}
                      className="shrink-0 flex items-center justify-center text-[rgba(30,24,20,0.18)] hover:text-[rgba(30,24,20,0.55)] transition-colors duration-200"
                      style={{ width: 28, height: 60, background: "none", border: "none", cursor: "pointer" }}
                    >
                      <ChevronLeft size={22} strokeWidth={1} />
                    </button>
                    <div ref={recsRef} className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                      {(() => {
                        const clothingRecs = [
                          { handle: "moi-versa-top-white", name: "MOI VERSA TOP", color: "White", price: "1,399 EGP", image: IMAGES.product2.colorImages.White as string, swatch: "#f5f0e8" },
                          { handle: "moi-versa-top-yellow", name: "MOI VERSA TOP", color: "Yellow", price: "1,399 EGP", image: IMAGES.product2.colorImages.Yellow as string, swatch: "#e8d080" },
                          { handle: "moi-versa-top-teal", name: "MOI VERSA TOP", color: "Teal", price: "1,399 EGP", image: IMAGES.product2.colorImages.Teal as string, swatch: "#4a8a8a" },
                          { handle: "moi-wavvy-light-blue", name: "MOI WAVVY", color: "Light Blue", price: "899 EGP", image: IMAGES.product1.colorImages["Light Blue"] as string, swatch: "#a8c8d8" },
                          { handle: "moi-wavvy-navy", name: "MOI WAVVY", color: "Navy", price: "899 EGP", image: IMAGES.product1.colorImages.Navy as string, swatch: "#3a5a7a" },
                          { handle: "moi-wavvy-mint", name: "MOI WAVVY", color: "Mint", price: "899 EGP", image: IMAGES.product1.colorImages.Mint as string, swatch: "#98c8a8" },
                        ];
                        const visible = clothingRecs.filter((r) => r.handle !== handle).slice(0, 6);
                        return visible.map((rec) => (
                          <button
                          key={rec.handle}
                          type="button"
                          onClick={() => onNavigate(rec.handle)}
                          className="flex-shrink-0 text-left cursor-pointer group"
                          style={{ width: 120 }}
                        >
                          <div className="overflow-hidden rounded-sm mb-2" style={{ aspectRatio: "3/4", backgroundColor: "rgba(30,24,20,0.04)" }}>
                            <img
                              src={rec.image}
                              alt={rec.name}
                              className="w-full h-full"
                              style={{ objectFit: "cover", transition: "transform 0.5s ease" }}
                              loading="lazy"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, backgroundColor: rec.swatch, border: "1px solid rgba(30,24,20,0.14)" }} />
                            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8a7e74" }}>
                              {rec.color}
                            </span>
                          </div>
                          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(0.82rem, 2vw, 0.94rem)", fontWeight: 300, color: "#1e1814", lineHeight: 1.2 }}>
                            {rec.name}
                          </p>
                          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.1em", color: "#7a6e64", marginTop: 2 }}>
                            {rec.price}
                          </p>
                        </button>
                      ));
                    })()}
                    </div>
                    <button
                      type="button"
                      aria-label="Scroll right"
                      onClick={() => recsRef.current?.scrollBy({ left: 140, behavior: "smooth" })}
                      className="shrink-0 flex items-center justify-center text-[rgba(30,24,20,0.18)] hover:text-[rgba(30,24,20,0.55)] transition-colors duration-200"
                      style={{ width: 28, height: 60, background: "none", border: "none", cursor: "pointer" }}
                    >
                      <ChevronRight size={22} strokeWidth={1} />
                    </button>
                  </div>
                  {/* Mobile: same scrollable list, no arrows */}
                  <div className="md:hidden flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                    {(() => {
                      const clothingRecs = [
                        { handle: "moi-versa-top-white", name: "MOI VERSA TOP", color: "White", price: "1,399 EGP", image: IMAGES.product2.colorImages.White as string, swatch: "#f5f0e8" },
                        { handle: "moi-versa-top-yellow", name: "MOI VERSA TOP", color: "Yellow", price: "1,399 EGP", image: IMAGES.product2.colorImages.Yellow as string, swatch: "#e8d080" },
                        { handle: "moi-versa-top-teal", name: "MOI VERSA TOP", color: "Teal", price: "1,399 EGP", image: IMAGES.product2.colorImages.Teal as string, swatch: "#4a8a8a" },
                        { handle: "moi-wavvy-light-blue", name: "MOI WAVVY", color: "Light Blue", price: "899 EGP", image: IMAGES.product1.colorImages["Light Blue"] as string, swatch: "#a8c8d8" },
                        { handle: "moi-wavvy-navy", name: "MOI WAVVY", color: "Navy", price: "899 EGP", image: IMAGES.product1.colorImages.Navy as string, swatch: "#3a5a7a" },
                        { handle: "moi-wavvy-mint", name: "MOI WAVVY", color: "Mint", price: "899 EGP", image: IMAGES.product1.colorImages.Mint as string, swatch: "#98c8a8" },
                      ];
                      const visible = clothingRecs.filter((r) => r.handle !== handle).slice(0, 6);
                      return visible.map((rec) => (
                        <button
                          key={rec.handle}
                          type="button"
                          onClick={() => onNavigate(rec.handle)}
                          className="flex-shrink-0 text-left cursor-pointer group"
                          style={{ width: 120 }}
                        >
                          <div className="overflow-hidden rounded-sm mb-2" style={{ aspectRatio: "3/4", backgroundColor: "rgba(30,24,20,0.04)" }}>
                            <img
                              src={rec.image}
                              alt={rec.name}
                              className="w-full h-full"
                              style={{ objectFit: "cover", transition: "transform 0.5s ease" }}
                              loading="lazy"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, backgroundColor: rec.swatch, border: "1px solid rgba(30,24,20,0.14)" }} />
                            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8a7e74" }}>
                              {rec.color}
                            </span>
                          </div>
                          <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(0.82rem, 2vw, 0.94rem)", fontWeight: 300, color: "#1e1814", lineHeight: 1.2 }}>
                            {rec.name}
                          </p>
                          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.1em", color: "#7a6e64", marginTop: 2 }}>
                            {rec.price}
                          </p>
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
      </div>

      <NotifyMeModal
        open={notifyModalOpen}
        productTitle={product.name}
        variantTitle={selectedSize || "One Size"}
        onClose={() => setNotifyModalOpen(false)}
        onSubmit={subscribeToRestock}
      />

      {/* Full-screen zoom lightbox — pinch, double-tap, swipe nav */}
      <CinematicLightbox
        images={galleryImages}
        initialIndex={galleryIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
