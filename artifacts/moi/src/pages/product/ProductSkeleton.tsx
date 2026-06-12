import { ImageSkeleton } from "@/components/ImageSkeleton";

export function ProductSkeleton() {
  return (
    <>
      {/* ── DESKTOP skeleton (lg+): 3-col to match real layout ── */}
      <div className="hidden lg:block" style={{ maxWidth: 1280, margin: "0 auto", padding: "120px 28px 96px" }}>
        {/* Breadcrumb */}
        <div className="relative overflow-hidden rounded mb-10" style={{ height: 12, width: 160, backgroundColor: "rgba(30,24,20,0.05)" }}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
        </div>
        {/* 3-col grid */}
        <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.35fr 0.85fr", gap: "0 48px", alignItems: "start" }}>
          {/* Col 1: Story */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
            <div className="relative overflow-hidden rounded" style={{ height: 10, width: 80, backgroundColor: "rgba(30,24,20,0.05)" }}>
              <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
            </div>
            <div className="relative overflow-hidden rounded" style={{ height: 44, width: "80%", backgroundColor: "rgba(30,24,20,0.05)" }}>
              <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
            </div>
            <div className="relative overflow-hidden rounded" style={{ height: 36, width: "55%", backgroundColor: "rgba(30,24,20,0.04)" }}>
              <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
            </div>
            <div style={{ height: 1, backgroundColor: "rgba(30,24,20,0.07)", margin: "4px 0" }} />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="relative overflow-hidden rounded" style={{ height: 12, width: i === 4 ? "65%" : "100%", backgroundColor: "rgba(30,24,20,0.04)" }}>
                <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
              </div>
            ))}
          </div>
          {/* Col 2: Image */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="relative overflow-hidden" style={{ aspectRatio: "3/4", backgroundColor: "rgba(30,24,20,0.05)", boxShadow: "0 16px 56px rgba(30,24,20,0.08)" }}>
              <ImageSkeleton variant="warm" />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="relative overflow-hidden" style={{ width: 58, height: 76, backgroundColor: "rgba(30,24,20,0.05)" }}>
                  <ImageSkeleton variant="warm" />
                </div>
              ))}
            </div>
          </div>
          {/* Col 3: Purchase */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>
            <div className="relative overflow-hidden rounded" style={{ height: 34, width: "60%", backgroundColor: "rgba(30,24,20,0.05)" }}>
              <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
            </div>
            <div style={{ height: 1, backgroundColor: "rgba(30,24,20,0.07)" }} />
            <div className="relative overflow-hidden rounded" style={{ height: 10, width: 64, backgroundColor: "rgba(30,24,20,0.04)" }}>
              <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: "rgba(30,24,20,0.07)" }} />
              ))}
            </div>
            <div className="relative overflow-hidden rounded" style={{ height: 10, width: 48, backgroundColor: "rgba(30,24,20,0.04)" }}>
              <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="relative overflow-hidden rounded" style={{ height: 32, flex: 1, backgroundColor: "rgba(30,24,20,0.05)" }}>
                  <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
                </div>
              ))}
            </div>
            <div className="relative overflow-hidden rounded" style={{ height: 46, backgroundColor: "rgba(30,24,20,0.07)" }}>
              <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
            </div>
            <div className="relative overflow-hidden rounded" style={{ height: 46, backgroundColor: "rgba(30,24,20,0.04)" }}>
              <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE skeleton (<lg): gallery → info stack ── */}
      <div className="lg:hidden">
        {/* Full-bleed image */}
        <div className="relative overflow-hidden w-full" style={{ aspectRatio: "3/4", backgroundColor: "rgba(30,24,20,0.05)" }}>
          <ImageSkeleton variant="warm" />
        </div>
        {/* Dot indicators */}
        <div style={{ display: "flex", gap: 5, justifyContent: "center", padding: "10px 0 4px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 5, borderRadius: 3, backgroundColor: `rgba(30,24,20,${i === 1 ? 0.2 : 0.07})`, width: i === 1 ? 18 : 5 }} />
          ))}
        </div>
        {/* Info */}
        <div style={{ padding: "16px 20px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="relative overflow-hidden rounded" style={{ height: 36, width: "75%", backgroundColor: "rgba(30,24,20,0.05)" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
          </div>
          <div className="relative overflow-hidden rounded" style={{ height: 22, width: "35%", backgroundColor: "rgba(30,24,20,0.04)" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
          </div>
          <div style={{ height: 1, backgroundColor: "rgba(30,24,20,0.07)" }} />
          <div className="relative overflow-hidden rounded" style={{ height: 10, width: 60, backgroundColor: "rgba(30,24,20,0.04)" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: "rgba(30,24,20,0.07)" }} />
            ))}
          </div>
          <div className="relative overflow-hidden rounded" style={{ height: 10, width: 44, backgroundColor: "rgba(30,24,20,0.04)" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="relative overflow-hidden rounded" style={{ height: 38, flex: 1, backgroundColor: "rgba(30,24,20,0.05)" }}>
                <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
              </div>
            ))}
          </div>
          <div className="relative overflow-hidden rounded" style={{ height: 48, backgroundColor: "rgba(30,24,20,0.07)" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)", animation: "moi-shimmer 1.6s ease-in-out infinite" }} />
          </div>
        </div>
      </div>
    </>
  );
}
