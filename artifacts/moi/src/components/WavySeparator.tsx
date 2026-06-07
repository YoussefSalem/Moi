export function WavySeparator() {
  return (
    <div
      className="w-full overflow-hidden"
      style={{
        background: "linear-gradient(to bottom, #ffffff 0%, #f0ece6 100%)",
        paddingTop: "clamp(52px, 8vw, 96px)",
        paddingBottom: "clamp(52px, 8vw, 96px)",
      }}
      aria-hidden="true"
    >
      <div
        style={{
          width: "200%",
          animation: "moiWaveScroll 12s linear infinite",
          willChange: "transform",
        }}
      >
        <svg
          viewBox="0 0 400 48"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: 48, display: "block" }}
          preserveAspectRatio="none"
        >
          {/* Echo wave — faint, shifted up */}
          <path
            d="M0,20 C27,7 73,7 100,20 C127,33 173,33 200,20 C227,7 273,7 300,20 C327,33 373,33 400,20"
            fill="none"
            stroke="rgba(180,155,130,0.16)"
            strokeWidth="1"
            strokeLinecap="round"
            transform="translate(0,-6)"
          />
          {/* Primary wave */}
          <path
            d="M0,24 C27,11 73,11 100,24 C127,37 173,37 200,24 C227,11 273,11 300,24 C327,37 373,37 400,24"
            fill="none"
            stroke="rgba(180,155,130,0.42)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
