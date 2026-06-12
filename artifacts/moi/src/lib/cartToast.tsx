import { toast } from "sonner";

export function showAddedToBagToast(color?: string, size?: string) {
  const detail = [color, size && size !== "One Size" ? size : undefined]
    .filter(Boolean)
    .join("  ·  ");

  toast.custom(
    () => (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "10px",
          background: "#faf8f5",
          border: "1px solid rgba(30,24,20,0.14)",
          borderRadius: "2px",
          padding: "11px 20px",
          fontFamily: "'Montserrat', sans-serif",
          boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
          pointerEvents: "none",
        }}
      >
        <svg
          width="11"
          height="9"
          viewBox="0 0 11 9"
          fill="none"
          style={{ flexShrink: 0, opacity: 0.7 }}
        >
          <path
            d="M1 4L4 7.5L10 1"
            stroke="#1e1814"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div>
          <div
            style={{
              fontSize: "9.5px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 500,
              color: "#1e1814",
            }}
          >
            Added to bag
          </div>
          {detail && (
            <div
              style={{
                fontSize: "9px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(30,24,20,0.45)",
                marginTop: "3px",
              }}
            >
              {detail}
            </div>
          )}
        </div>
      </div>
    ),
    { duration: 2000 }
  );
}
