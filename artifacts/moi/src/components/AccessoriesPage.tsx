import { ProductCard } from "@/components/ProductCard";
import { IMAGES, type ProductConfig } from "@/config/images";
import { useShopifyProductByHandle } from "@/hooks/useShopifyProductByHandle";

interface AccessoriesPageProps {
  onLookView: (product: ProductConfig) => void;
}

export function AccessoriesPage({ onLookView }: AccessoriesPageProps) {
  const { product } = useShopifyProductByHandle("trio-bangles", IMAGES.product3);

  return (
    <main id="accessories" className="pt-4 md:pt-8 pb-24 md:pb-32">
      <ProductCard product={product} onLookView={onLookView} />
    </main>
  );
}
