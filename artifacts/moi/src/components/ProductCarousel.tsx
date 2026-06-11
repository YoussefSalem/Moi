import { useState } from "react";

export interface CarouselItem {
  handle: string;
  name: string;
  color?: string;
  swatch?: string;
  price: string;
  image: string;
}

interface ProductCarouselProps {
  items: CarouselItem[];
  onItemClick: (handle: string) => void;
  heading?: string;
  subheading?: string;
}

function CardImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {!loaded && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg,#f0ede8 25%,#e3dfd8 50%,#f0ede8 75%)",
            backgroundSize: "200% 100%",
            animation: "moiCarouselShimmer 1.6s ease-in-out infinite",
          }}
        />
      )}
      {src && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            pointerEvents: "none",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.35s ease",
          }}
          draggable={false}
          loading="lazy"
        />
      )}
    </div>
  );
}

export function ProductCarousel({
  items,
  onItemClick,
  heading = "Curated For You",
  subheading = "You May Also Like",
}: ProductCarouselProps) {
  if (items.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes moiCarouselShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .moi-carousel-track {
          display: flex;
          gap: 20px;
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding-bottom: 4px;
          box-sizing: border-box;
          touch-action: pan-x;
        }
        .moi-carousel-track::-webkit-scrollbar {
          display: none;
        }
        .moi-carousel-card {
          flex: 0 0 clamp(160px, 44vw, 260px);
          width: clamp(160px, 44vw, 260px);
          background: none;
          border: none;
          padding: 0;
          text-align: left;
          cursor: pointer;
          user-select: none;
          touch-action: pan-x;
        }
      `}</style>

      <div
        style={{
          backgroundColor: "#faf8f5",
          borderTop: "1px solid rgba(30,24,20,0.07)",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "72px 0 56px 28px",
          }}
        >
          <div
            style={{
              paddingRight: 28,
              marginBottom: 40,
            }}
          >
            <p
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "#7a6e64",
                marginBottom: 14,
              }}
            >
              {subheading}
            </p>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
                fontWeight: 400,
                letterSpacing: "0.04em",
                color: "#1e1814",
              }}
            >
              {heading}
            </h2>
          </div>

          <div className="moi-carousel-track">
            {items.map((item) => (
              <button
                key={item.handle}
                type="button"
                className="moi-carousel-card"
                onClick={() => onItemClick(item.handle)}
                draggable={false}
              >
                <div
                  style={{
                    aspectRatio: "3/4",
                    overflow: "hidden",
                    marginBottom: 12,
                    backgroundColor: "rgba(30,24,20,0.04)",
                  }}
                >
                  <CardImage src={item.image} alt={item.name} />
                </div>

                {item.color && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                    {item.swatch && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: item.swatch,
                          border: "1px solid rgba(30,24,20,0.14)",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: 9,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: "#8a7e74",
                      }}
                    >
                      {item.color}
                    </span>
                  </div>
                )}

                <p
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: "clamp(0.9rem, 2vw, 1.1rem)",
                    fontWeight: 300,
                    color: "#1e1814",
                    lineHeight: 1.2,
                    marginBottom: 3,
                  }}
                >
                  {item.name}
                </p>
                <p
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    color: "#7a6e64",
                  }}
                >
                  {item.price}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
