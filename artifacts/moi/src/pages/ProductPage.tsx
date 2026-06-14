import { motion, AnimatePresence } from "framer-motion";
import { transitions } from "@/lib/motion";
import { ArrowLeft } from "lucide-react";
import { ProductCarousel, type CarouselItem } from "@/components/ProductCarousel";
import { CinematicLightbox } from "@/components/CinematicLightbox";
import { NotifyMeModal } from "@/components/NotifyMeModal";
import { WriteReviewModal } from "@/components/WriteReviewModal";
import { Footer } from "@/components/Footer";
import { ProductSkeleton } from "./product/ProductSkeleton";
import { ProductReviews } from "./product/ProductReviews";
import { SizeGuideModal } from "./product/SizeGuideModal";
import { ProductDesktopLayout } from "./product/ProductDesktopLayout";
import { ProductMobileSection } from "./product/ProductMobileSection";
import { useProductPageState } from "./product/useProductPageState";

interface ProductPageProps {
  handle: string;
  autoOpenReview?: boolean;
  onBack: () => void;
  onNavigate?: (handle: string) => void;
  onPageNavigate?: (page: "home" | "accessories" | "ambassador" | "privacy" | "refund" | "return" | "delivery", hash?: string) => void;
}

export function ProductPage({ handle, autoOpenReview, onBack, onNavigate, onPageNavigate }: ProductPageProps) {
  const s = useProductPageState(handle, autoOpenReview);

  return (
    <>
      <div
        className="min-h-screen"
        style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(245,240,232,0.6) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(230,220,205,0.25) 0%, transparent 50%), #faf8f5" }}
      >
        <div className="lg:hidden w-full px-5 pt-20 pb-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 transition-opacity duration-200 hover:opacity-60"
            style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase", color: "#8a7e74" }}
          >
            <ArrowLeft size={14} strokeWidth={1.4} />
            Back
          </button>
        </div>

        <AnimatePresence mode="wait">
          {s.loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transitions.quick}>
              <ProductSkeleton />
            </motion.div>
          ) : (
            <motion.div key="content" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={transitions.reveal}>

              <ProductDesktopLayout
                product={s.product}
                pageColorName={s.pageColorName}
                galleryImages={s.galleryImages}
                galleryIndex={s.galleryIndex}
                setGalleryIndex={s.setGalleryIndex}
                imgLoaded={s.imgLoaded}
                setImgLoaded={s.setImgLoaded}
                thumbLoaded={s.thumbLoaded}
                setThumbLoaded={s.setThumbLoaded}
                isOutOfStock={s.isOutOfStock}
                effectivePrice={s.effectivePrice}
                effectiveCompareAtPrice={s.effectiveCompareAtPrice ?? null}
                displaySizes={s.displaySizes}
                selectedSize={s.selectedSize}
                setSelectedSize={s.setSelectedSize}
                sizeOption={s.sizeOption}
                selectedVariant={s.selectedVariant}
                addedFeedback={s.addedFeedback}
                applePayAvailable={s.applePayAvailable}
                waHover={s.waHover}
                setWaHover={s.setWaHover}
                setSizeGuideOpen={s.setSizeGuideOpen}
                setLightboxOpen={s.setLightboxOpen}
                onBack={onBack}
                nextImg={s.nextImg}
                prevImg={s.prevImg}
                handleAddToCart={s.handleAddToCart}
                handleBuyNow={s.handleBuyNow}
                handleNotifyMe={s.handleNotifyMe}
              />

              <ProductMobileSection
                product={s.product}
                pageColorName={s.pageColorName}
                galleryImages={s.galleryImages}
                galleryIndex={s.galleryIndex}
                setGalleryIndex={s.setGalleryIndex}
                setLightboxOpen={s.setLightboxOpen}
                isOutOfStock={s.isOutOfStock}
                effectivePrice={s.effectivePrice}
                effectiveCompareAtPrice={s.effectiveCompareAtPrice ?? null}
                displaySizes={s.displaySizes}
                selectedSize={s.selectedSize}
                setSelectedSize={s.setSelectedSize}
                sizeOption={s.sizeOption}
                selectedVariant={s.selectedVariant}
                applePayAvailable={s.applePayAvailable}
                addedFeedback={s.addedFeedback}
                waHover={s.waHover}
                setWaHover={s.setWaHover}
                setSizeGuideOpen={s.setSizeGuideOpen}
                handleNotifyMe={s.handleNotifyMe}
                handleAddToCart={s.handleAddToCart}
                handleBuyNow={s.handleBuyNow}
                setMobileGalleryTrackRef={s.setMobileGalleryTrackRef}
                mobileGalleryRawIdxRef={s.mobileGalleryRawIdxRef}
                mobileGalleryDragRef={s.mobileGalleryDragRef}
                mobileGalleryDidDragRef={s.mobileGalleryDidDragRef}
              />

              <ProductReviews {...s.reviewsPagination} onWriteReview={() => s.setReviewModalOpen(true)} />

              {onNavigate && s.recs.length > 0 && (() => {
                const carouselItems: CarouselItem[] = s.recs.map((rec) => ({
                  handle: rec.handle,
                  name: rec.name,
                  color: rec.color,
                  swatch: rec.swatch,
                  price: rec.price,
                  image: rec.image(),
                }));
                return <ProductCarousel items={carouselItems} onItemClick={onNavigate} subheading="You May Also Like" heading="Curated For You" />;
              })()}

              <Footer onNavigate={onPageNavigate} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <NotifyMeModal
        open={s.notifyModalOpen}
        productTitle={s.product.name}
        variantTitle={s.selectedSize || "One Size"}
        onClose={() => s.setNotifyModalOpen(false)}
        onSubmit={s.subscribeToRestock}
      />

      <WriteReviewModal
        open={s.reviewModalOpen}
        productHandle={handle}
        variantId={s.selectedVariant?.id}
        onClose={() => s.setReviewModalOpen(false)}
      />

      <CinematicLightbox images={s.galleryImages} initialIndex={s.galleryIndex} open={s.lightboxOpen} onClose={() => s.setLightboxOpen(false)} />
      <CinematicLightbox images={s.carouselLb.images} initialIndex={s.carouselLb.idx} open={s.carouselLb.open} onClose={() => s.setCarouselLb((prev) => ({ ...prev, open: false }))} />
      <SizeGuideModal open={s.sizeGuideOpen} onClose={() => s.setSizeGuideOpen(false)} />
    </>
  );
}
