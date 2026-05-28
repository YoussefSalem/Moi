import { ArrowLeft } from "lucide-react";

interface NotFoundPageProps {
  onNavigateHome: () => void;
}

export function NotFoundPage({ onNavigateHome }: NotFoundPageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: "hsl(30 15% 95%)" }}>
      <div className="text-center max-w-md">
        {/* Brand mark */}
        <p
          className="text-[10px] tracking-[0.5em] uppercase mb-6"
          style={{ color: "rgba(120,108,96,0.4)", fontFamily: "'Montserrat', sans-serif" }}
        >
          Moi
        </p>

        {/* Large 404 */}
        <h1
          className="text-7xl md:text-8xl mb-4"
          style={{
            color: "rgba(30,24,20,0.08)",
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontWeight: 300,
            letterSpacing: "0.08em",
            lineHeight: 1,
          }}
        >
          404
        </h1>

        {/* Heading */}
        <h2
          className="text-xl md:text-2xl mb-3"
          style={{
            color: "#1e1814",
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontWeight: 300,
            letterSpacing: "0.04em",
          }}
        >
          Page Not Found
        </h2>

        {/* Subtext */}
        <p
          className="text-sm mb-10 leading-relaxed"
          style={{
            color: "rgba(30,24,20,0.5)",
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          The page you are looking for does not exist or has been moved.
        </p>

        {/* Divider */}
        <div className="w-12 h-px mx-auto mb-10" style={{ backgroundColor: "rgba(30,24,20,0.12)" }} />

        {/* Back button */}
        <button
          onClick={onNavigateHome}
          className="inline-flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase hover:opacity-50 transition-opacity"
          style={{ color: "#1e1814", fontFamily: "'Montserrat', sans-serif" }}
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          Back to Home
        </button>
      </div>

      {/* Footer note */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p
          className="text-[9px] tracking-[0.3em] uppercase"
          style={{ color: "rgba(120,108,96,0.3)", fontFamily: "'Montserrat', sans-serif" }}
        >
          &copy; 2026 Moi. All rights reserved.
        </p>
      </div>
    </div>
  );
}
