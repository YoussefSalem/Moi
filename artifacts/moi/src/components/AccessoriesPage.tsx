import { ProductCard } from "@/components/ProductCard";
import { IMAGES, type ProductConfig } from "@/config/images";

interface AccessoriesPageProps {
  onLookView: (product: ProductConfig) => void;
}

export function AccessoriesPage({ onLookView }: AccessoriesPageProps) {
  return (
    <main id="accessories">
      <ProductCard product={IMAGES.product3} onLookView={onLookView} />
    </main>
  );
}
