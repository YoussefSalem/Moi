export function ProductTrustBadges() {
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, padding: "12px 14px", border: "1px solid rgba(30,24,20,0.10)", borderRadius: 4 }}>
      {[
        {
          icon: (
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <rect x="1" y="6" width="14" height="7" rx="1" stroke="#6b6258" strokeWidth="1.3"/>
              <path d="M4 6V5a4 4 0 018 0v1" stroke="#6b6258" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="5" cy="12" r="1.5" fill="#6b6258"/>
              <circle cx="11" cy="12" r="1.5" fill="#6b6258"/>
            </svg>
          ),
          text: "2–4 day delivery in Egypt",
        },
        {
          icon: (
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <rect x="1" y="6" width="14" height="9" rx="1" stroke="#6b6258" strokeWidth="1.3"/>
              <path d="M5 6V4.5A3 3 0 018 1.5v0A3 3 0 0111 4.5V6" stroke="#6b6258" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="8" y1="9" x2="8" y2="12" stroke="#6b6258" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="6.5" y1="10.5" x2="9.5" y2="10.5" stroke="#6b6258" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          ),
          text: "Cash on delivery available",
        },
        {
          icon: (
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5L2 4v4c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V4L8 1.5z" stroke="#6b6258" strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M5.5 8l1.5 1.5L10.5 6" stroke="#6b6258" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ),
          text: "Secure checkout",
        },
      ].map(({ icon, text }) => (
        <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {icon}
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12.5, color: "#6b6258", fontWeight: 400, letterSpacing: "0.03em" }}>{text}</span>
        </div>
      ))}
    </div>
  );
}
