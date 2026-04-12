import { useState } from "react";
import { Header } from "@/components/Header";
import { HeroVideo } from "@/components/HeroVideo";
import { ProductCard } from "@/components/ProductCard";
import { Carousel } from "@/components/Carousel";
import { LookView } from "@/components/LookView";
import { Footer } from "@/components/Footer";
import { IMAGES, type ProductConfig } from "@/config/images";

function App() {
  const [lookProduct, setLookProduct] = useState<ProductConfig | null>(null);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "hsl(30 15% 95%)" }}>
      <Header />

      <main>
        <HeroVideo />

        <ProductCard
          product={IMAGES.product1}
          onLookView={setLookProduct}
        />

        <Carousel />

        <ProductCard
          product={IMAGES.product2}
          onLookView={setLookProduct}
        />
      </main>

      <Footer />

      <LookView product={lookProduct} onClose={() => setLookProduct(null)} />
    </div>
  );
}

export default App;
