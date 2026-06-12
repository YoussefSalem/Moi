import { useEffect, useRef, useState } from "react";

const DOMAIN = "https://3095ac8c-c529-4d3f-b18a-1650accab2e5-00-2nu3cckgl9eyi.kirk.replit.dev";

const HERO_IMG = "/__mockup/images/moi-hero.png";
const WAVVY_IMG = "/__mockup/images/moi-wavvy.png";
const VERSA_IMG = "/__mockup/images/moi-versa.png";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function AppleLanding() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const container = document.getElementById("moi-scroll-root");
    const onScroll = () => setScrollY(container?.scrollTop ?? 0);
    container?.addEventListener("scroll", onScroll, { passive: true });
    return () => container?.removeEventListener("scroll", onScroll);
  }, []);

  const heroBg = Math.min(scrollY / 600, 1);
  const heroImgScale = 1 + scrollY * 0.0002;
  const heroTextY = scrollY * 0.35;

  return (
    <div
      id="moi-scroll-root"
      style={{
        fontFamily: "'Montserrat', sans-serif",
        backgroundColor: "#faf8f5",
        color: "#1e1814",
        overflowY: "auto",
        overflowX: "hidden",
        height: "100vh",
        scrollBehavior: "smooth",
      }}
    >
      {/* ─── HEADER ─── */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          height: 64,
          backgroundColor: scrollY > 80 ? "rgba(250,248,245,0.92)" : "transparent",
          backdropFilter: scrollY > 80 ? "blur(12px)" : "none",
          transition: "background-color 0.4s ease, backdrop-filter 0.4s ease",
        }}
      >
        <div style={{ width: 28, height: 20, display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 1, backgroundColor: scrollY > 80 ? "#1e1814" : "#fff", transition: "background-color 0.4s" }} />
          ))}
        </div>

        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 22,
          fontWeight: 400,
          letterSpacing: "0.35em",
          color: scrollY > 80 ? "#1e1814" : "#fff",
          transition: "color 0.4s",
          userSelect: "none",
        }}>
          MOI
        </div>

        <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
          {["🔍", "♡", "◻"].map((icon, i) => (
            <div key={i} style={{ fontSize: 15, cursor: "pointer", color: scrollY > 80 ? "#1e1814" : "#fff", transition: "color 0.4s", opacity: 0.85 }}>
              {["⌕", "♡", "⊡"][i]}
            </div>
          ))}
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section
        ref={heroRef}
        style={{
          position: "relative",
          height: "100vh",
          overflow: "hidden",
          backgroundColor: "#0f0d0b",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${HERO_IMG})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            transform: `scale(${heroImgScale})`,
            transition: "transform 0.05s linear",
            opacity: 0.72,
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(15,13,11,0.25) 0%, rgba(15,13,11,0.55) 100%)" }} />

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            transform: `translateY(${heroTextY}px)`,
            transition: "transform 0.05s linear",
          }}
        >
          <p style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 11,
            letterSpacing: "0.4em",
            color: "rgba(255,255,255,0.65)",
            marginBottom: 32,
            textTransform: "uppercase",
          }}>
            Summer 2026 Collection
          </p>

          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(80px, 12vw, 148px)",
            fontWeight: 300,
            color: "#fff",
            letterSpacing: "0.12em",
            lineHeight: 1,
            margin: 0,
            textAlign: "center",
          }}>
            Effortless.
          </h1>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(80px, 12vw, 148px)",
            fontWeight: 300,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.88)",
            letterSpacing: "0.12em",
            lineHeight: 1,
            margin: "0 0 40px 0",
            textAlign: "center",
          }}>
            Egyptian.
          </h1>

          <p style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 12,
            letterSpacing: "0.25em",
            color: "rgba(255,255,255,0.6)",
            textTransform: "uppercase",
            marginBottom: 56,
            textAlign: "center",
            maxWidth: 320,
            lineHeight: 1.8,
          }}>
            Designed for women who drift through days and evenings with equal ease.
          </p>

          <button style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.45)",
            color: "#fff",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 10,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            padding: "14px 40px",
            cursor: "pointer",
            transition: "border-color 0.3s, background 0.3s",
          }}>
            Discover the Collection
          </button>
        </div>

        <div style={{
          position: "absolute",
          bottom: 36,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          opacity: 0.5,
        }}>
          <div style={{ width: 1, height: 56, background: "linear-gradient(to bottom, transparent, #fff)" }} />
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, letterSpacing: "0.3em", color: "#fff", textTransform: "uppercase" }}>Scroll</p>
        </div>
      </section>

      {/* ─── TRUST BAR ─── */}
      <Reveal>
        <div style={{
          borderTop: "1px solid rgba(30,24,20,0.08)",
          borderBottom: "1px solid rgba(30,24,20,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          padding: "18px 0",
          backgroundColor: "#faf8f5",
        }}>
          {["New Summer Drop", "Fast Delivery Across Egypt", "Limited Stock"].map((text, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              {i > 0 && <div style={{ width: 1, height: 14, background: "rgba(30,24,20,0.2)", margin: "0 32px" }} />}
              <span style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 10,
                fontWeight: 400,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(30,24,20,0.6)",
              }}>
                {text}
              </span>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ─── PRODUCT 1: MOI WAVVY ─── */}
      <section style={{ padding: "120px 0 100px", backgroundColor: "#faf8f5" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 60px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          <Reveal>
            <div style={{ position: "relative", overflow: "hidden" }}>
              <img
                src={WAVVY_IMG}
                alt="MOI WAVVY"
                style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }}
              />
              <div style={{
                position: "absolute",
                bottom: 24,
                left: 24,
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 9,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.75)",
                backgroundColor: "rgba(30,24,20,0.35)",
                padding: "6px 12px",
                backdropFilter: "blur(4px)",
              }}>
                Brown · 1,690 EGP
              </div>
            </div>
          </Reveal>

          <div style={{ paddingLeft: 20 }}>
            <Reveal delay={80}>
              <p style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 10,
                letterSpacing: "0.35em",
                textTransform: "uppercase",
                color: "rgba(30,24,20,0.45)",
                marginBottom: 28,
              }}>
                New Arrival
              </p>
            </Reveal>

            <Reveal delay={140}>
              <h2 style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(56px, 6vw, 88px)",
                fontWeight: 300,
                lineHeight: 1.0,
                color: "#1e1814",
                margin: "0 0 8px 0",
                letterSpacing: "0.04em",
              }}>
                MOI
              </h2>
              <h2 style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(56px, 6vw, 88px)",
                fontWeight: 300,
                fontStyle: "italic",
                lineHeight: 1.0,
                color: "#1e1814",
                margin: "0 0 40px 0",
                letterSpacing: "0.04em",
              }}>
                Wavvy
              </h2>
            </Reveal>

            <Reveal delay={200}>
              <p style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 20,
                fontStyle: "italic",
                fontWeight: 300,
                lineHeight: 1.75,
                color: "rgba(30,24,20,0.65)",
                maxWidth: 340,
                marginBottom: 48,
              }}>
                "The ultimate throw-and-go. Light, breathable, and made for drifting through your day."
              </p>
            </Reveal>

            <Reveal delay={260}>
              <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                <button style={{
                  backgroundColor: "#1e1814",
                  color: "#faf8f5",
                  border: "none",
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: 10,
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  padding: "16px 36px",
                  cursor: "pointer",
                }}>
                  Shop Now
                </button>
                <span style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: 10,
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  color: "rgba(30,24,20,0.5)",
                  cursor: "pointer",
                  borderBottom: "1px solid rgba(30,24,20,0.25)",
                  paddingBottom: 2,
                }}>
                  View Look
                </span>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── EDITORIAL DIVIDER ─── */}
      <Reveal>
        <section style={{
          backgroundColor: "#f0ece5",
          padding: "100px 60px",
          textAlign: "center",
          position: "relative",
        }}>
          <div style={{ width: 48, height: 1, background: "rgba(30,24,20,0.2)", margin: "0 auto 48px" }} />
          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(28px, 3.5vw, 48px)",
            fontWeight: 300,
            fontStyle: "italic",
            lineHeight: 1.45,
            color: "#1e1814",
            maxWidth: 680,
            margin: "0 auto 48px",
            letterSpacing: "0.02em",
          }}>
            "Designed in Cairo.<br />Made for everywhere."
          </p>
          <div style={{ width: 48, height: 1, background: "rgba(30,24,20,0.2)", margin: "0 auto" }} />
        </section>
      </Reveal>

      {/* ─── PRODUCT 2: MOI VERSA TOP ─── */}
      <section style={{ padding: "120px 0 100px", backgroundColor: "#1e1814" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 60px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          <div style={{ paddingRight: 20 }}>
            <Reveal delay={0}>
              <p style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 10,
                letterSpacing: "0.35em",
                textTransform: "uppercase",
                color: "rgba(250,248,245,0.35)",
                marginBottom: 28,
              }}>
                New Arrival
              </p>
            </Reveal>

            <Reveal delay={80}>
              <h2 style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(56px, 6vw, 88px)",
                fontWeight: 300,
                lineHeight: 1.0,
                color: "#faf8f5",
                margin: "0 0 8px 0",
                letterSpacing: "0.04em",
              }}>
                MOI
              </h2>
              <h2 style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(56px, 6vw, 88px)",
                fontWeight: 300,
                fontStyle: "italic",
                lineHeight: 1.0,
                color: "#faf8f5",
                margin: "0 0 40px 0",
                letterSpacing: "0.04em",
              }}>
                Versa Top
              </h2>
            </Reveal>

            <Reveal delay={140}>
              <p style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 20,
                fontStyle: "italic",
                fontWeight: 300,
                lineHeight: 1.75,
                color: "rgba(250,248,245,0.55)",
                maxWidth: 340,
                marginBottom: 48,
              }}>
                "Effortlessly versatile. A silhouette that moves with you, in every shade of summer."
              </p>
            </Reveal>

            <Reveal delay={200}>
              <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                <button style={{
                  backgroundColor: "#faf8f5",
                  color: "#1e1814",
                  border: "none",
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: 10,
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  padding: "16px 36px",
                  cursor: "pointer",
                }}>
                  Shop Now
                </button>
                <span style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: 10,
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  color: "rgba(250,248,245,0.4)",
                  cursor: "pointer",
                  borderBottom: "1px solid rgba(250,248,245,0.2)",
                  paddingBottom: 2,
                }}>
                  View Look
                </span>
              </div>
            </Reveal>
          </div>

          <Reveal delay={60}>
            <div style={{ position: "relative", overflow: "hidden" }}>
              <img
                src={VERSA_IMG}
                alt="MOI VERSA TOP"
                style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }}
              />
              <div style={{
                position: "absolute",
                bottom: 24,
                left: 24,
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 9,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.75)",
                backgroundColor: "rgba(30,24,20,0.45)",
                padding: "6px 12px",
                backdropFilter: "blur(4px)",
              }}>
                Taupe · 1,690 EGP
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── SOCIAL PROOF ─── */}
      <section style={{ padding: "120px 60px", backgroundColor: "#faf8f5" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 72 }}>
            <p style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(60px, 8vw, 112px)",
              fontWeight: 300,
              color: "#1e1814",
              lineHeight: 1,
              margin: "0 0 16px",
              letterSpacing: "0.04em",
            }}>
              10,000+
            </p>
            <p style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 11,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "rgba(30,24,20,0.45)",
            }}>
              Women Who Drift in Moi
            </p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, maxWidth: 900, margin: "0 auto" }}>
            {[
              { bg: "#d4c8bc", ratio: "4/5" },
              { bg: "#c8bfb4", ratio: "4/5" },
              { bg: "#bfb6aa", ratio: "4/5" },
              { bg: "#c2b9ad", ratio: "4/5" },
            ].map((card, i) => (
              <div key={i} style={{
                backgroundColor: card.bg,
                aspectRatio: card.ratio,
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
              }}>
                <div style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "flex-end",
                  padding: 12,
                  background: "linear-gradient(to top, rgba(30,24,20,0.5) 0%, transparent 60%)",
                }}>
                  <div>
                    <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.6)" }} />
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, letterSpacing: "0.15em", color: "rgba(255,255,255,0.8)" }}>
                        @moi.eg
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>▶</span>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{[42, 87, 31, 65][i]}K</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={200}>
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <span style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: 10,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "rgba(30,24,20,0.45)",
              cursor: "pointer",
              borderBottom: "1px solid rgba(30,24,20,0.2)",
              paddingBottom: 2,
            }}>
              Follow on TikTok
            </span>
          </div>
        </Reveal>
      </section>

      {/* ─── CTA BAND ─── */}
      <Reveal>
        <section style={{
          backgroundColor: "#1e1814",
          padding: "100px 60px",
          textAlign: "center",
        }}>
          <p style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 10,
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            color: "rgba(250,248,245,0.4)",
            marginBottom: 32,
          }}>
            Summer 2026
          </p>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(40px, 5vw, 64px)",
            fontWeight: 300,
            fontStyle: "italic",
            color: "#faf8f5",
            margin: "0 0 48px",
            lineHeight: 1.25,
            letterSpacing: "0.04em",
          }}>
            Yours for the drifting.
          </h2>
          <button style={{
            backgroundColor: "#faf8f5",
            color: "#1e1814",
            border: "none",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 10,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            padding: "18px 52px",
            cursor: "pointer",
          }}>
            Shop the Collection
          </button>
        </section>
      </Reveal>

      {/* ─── FOOTER ─── */}
      <footer style={{ backgroundColor: "#140f0b", padding: "64px 60px 40px", color: "rgba(250,248,245,0.45)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 60, marginBottom: 64 }}>
            <div>
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 32,
                fontWeight: 300,
                letterSpacing: "0.3em",
                color: "#faf8f5",
                marginBottom: 20,
              }}>
                MOI
              </div>
              <p style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 15,
                fontStyle: "italic",
                lineHeight: 1.7,
                color: "rgba(250,248,245,0.4)",
                maxWidth: 260,
              }}>
                Minimal Egyptian fashion for women who move through the world with intention.
              </p>
            </div>

            {[
              { heading: "Shop", links: ["Wavvy Top", "Versa Top", "Accessories", "New Arrivals"] },
              { heading: "About", links: ["Our Story", "Ambassador", "Sustainability", "Careers"] },
              { heading: "Help", links: ["Shipping", "Returns", "Care Guide", "Contact"] },
            ].map(col => (
              <div key={col.heading}>
                <p style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: 9,
                  letterSpacing: "0.35em",
                  textTransform: "uppercase",
                  color: "rgba(250,248,245,0.3)",
                  marginBottom: 24,
                }}>
                  {col.heading}
                </p>
                {col.links.map(link => (
                  <p key={link} style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 12,
                    letterSpacing: "0.05em",
                    color: "rgba(250,248,245,0.5)",
                    marginBottom: 14,
                    cursor: "pointer",
                  }}>
                    {link}
                  </p>
                ))}
              </div>
            ))}
          </div>

          <div style={{
            borderTop: "1px solid rgba(250,248,245,0.08)",
            paddingTop: 32,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.1em" }}>
              © 2026 Moi. All rights reserved.
            </span>
            <div style={{ display: "flex", gap: 28 }}>
              {["Instagram", "TikTok"].map(s => (
                <span key={s} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer" }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
