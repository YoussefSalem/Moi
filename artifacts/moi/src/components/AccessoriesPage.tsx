import { ProductCard } from "@/components/ProductCard";
import { IMAGES, type ProductConfig } from "@/config/images";
import { useShopifyProductByHandle } from "@/hooks/useShopifyProductByHandle";

interface AccessoriesPageProps {
  onNavigateToProduct: (handle: string) => void;
  onLookView: (product: ProductConfig) => void;
}

export function AccessoriesPage({ onNavigateToProduct, onLookView }: AccessoriesPageProps) {
  const { product } = useShopifyProductByHandle("trio-bangles", IMAGES.product3);

  return (
    <main id="accessories" className="pt-20 md:pt-24 pb-24 md:pb-32">
      <ProductCard
        product={product}
        onLookView={onLookView}
        onNavigateToProduct={onNavigateToProduct}
        hideLookView
      />
    </main>
  );
}
