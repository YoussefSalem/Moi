import { useState } from "react";
import { Header } from "@/components/Header";
import { HeroVideo } from "@/components/HeroVideo";
import { ProductCard } from "@/components/ProductCard";
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

        <ProductCard
          product={IMAGES.product2}
          onLookView={setLookProduct}
        />

        <section className="py-16 md:py-24 text-center px-6">
          <p
            className="text-lg md:text-2xl font-light tracking-[0.18em] uppercase"
            style={{ color: "#1e1814", fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Check out Instagram and TikTok
          </p>
        </section>
      </main>

      <Footer />

      <LookView product={lookProduct} onClose={() => setLookProduct(null)} />
    </div>
  );
}

export default App;
