"use client";

const stats = [
  {
    value: "1,200+",
    label: "Properties Listed",
    sub: "Across all communities",
    filled: true,
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <path d="M3 13L13 4L23 13" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="6" y="13" width="14" height="10" rx="1.2" stroke="white" strokeWidth="1.8"/>
        <rect x="10" y="17" width="6" height="6" rx="0.8" stroke="white" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    value: "AED 2.8B+",
    label: "Total Sales Volume",
    sub: "And growing",
    filled: false,
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <circle cx="13" cy="13" r="9" stroke="#7a8a9e" strokeWidth="1.8"/>
        <path d="M13 7v2M13 17v2" stroke="#7a8a9e" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M9.5 10.5c0-1 .9-1.8 2-1.8h3c1.1 0 2 .8 2 1.8 0 2.4-5.5 1.8-5.5 4.2 0 1 .9 1.8 2 1.8H16" stroke="#7a8a9e" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    value: "3,500+",
    label: "Happy Clients",
    sub: "From 50+ countries",
    filled: false,
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <circle cx="9" cy="9" r="3.5" stroke="#7a8a9e" strokeWidth="1.8"/>
        <circle cx="19" cy="9" r="2.8" stroke="#7a8a9e" strokeWidth="1.6"/>
        <path d="M2 21c0-3 3-5.5 7-5.5s7 2.5 7 5.5" stroke="#7a8a9e" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M20 15c2 .5 4 2.3 4 5" stroke="#7a8a9e" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    value: "15+",
    label: "Years Experience",
    sub: "Dubai specialists",
    filled: true,
    icon: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <circle cx="13" cy="13" r="9" stroke="white" strokeWidth="1.8"/>
        <path d="M13 8v5l3.5 2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

/* ── House-shaped image ── */
function HouseImage({ mobile = false }: { mobile?: boolean }) {
  const id = mobile ? "houseClipMobile" : "houseClipDesktop";
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: mobile ? 400 : "100%", margin: "0 auto", height: mobile ? 400 : "100%" }}>
      {/* Hidden SVG clipPath */}
      <svg width="0" height="0" style={{ position: "absolute", overflow: "hidden" }}>
        <defs>
          <clipPath id={id} clipPathUnits="objectBoundingBox">
            <path d="M0.5,0 L1.02,0.38 L0.86,0.38 L0.86,1 L0.14,1 L0.14,0.38 L-0.02,0.38 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* Clipped image fills 100% of its container height */}
      <div style={{
        width: "100%",
        height: "100%",
        clipPath: `url(#${id})`,
        overflow: "hidden",
        minHeight: mobile ? 400 : 520,
      }}>
        <img
          src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=90"
          alt="Elysian luxury property"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 20%",
            display: "block",
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(25,37,55,0.04) 0%, rgba(25,37,55,0.1) 100%)" }} />
      </div>

      {/* Decorative accents */}
      {!mobile && <>
        <div style={{ position: "absolute", bottom: "10%", right: "-4%", width: 100, height: 100, borderRadius: "50%", background: "#7fe2e3", opacity: 0.12, zIndex: -1 }} />
        <div style={{ position: "absolute", top: "26%", left: "-3%", width: 64, height: 64, borderRadius: 16, background: "#192537", opacity: 0.07, zIndex: -1 }} />
      </>}
    </div>
  );
}

/* ── Stat boxes ── */
function StatBoxes() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="ae-boxes">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="ae-box"
          style={{
            borderRadius: 20,
            padding: "24px 20px",
            /* aspect-ratio makes it square on desktop — overridden to auto on mobile */
            aspectRatio: "1 / 1",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: stat.filled ? "#192537" : "white",
            border: stat.filled ? "none" : "1.5px solid #e8edf4",
            boxShadow: stat.filled
              ? "0 8px 32px rgba(25,37,55,0.18)"
              : "0 4px 16px rgba(25,37,55,0.06)",
            transition: "transform 0.22s, box-shadow 0.22s",
            minHeight: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = stat.filled
              ? "0 18px 48px rgba(25,37,55,0.26)"
              : "0 12px 32px rgba(25,37,55,0.12)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = stat.filled
              ? "0 8px 32px rgba(25,37,55,0.18)"
              : "0 4px 16px rgba(25,37,55,0.06)";
          }}
        >
          {/* Icon */}
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: stat.filled ? "rgba(127,226,227,0.14)" : "rgba(25,37,55,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}>
            {stat.icon}
          </div>

          {/* Text */}
          <div>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: "clamp(16px, 3.5vw, 24px)", color: stat.filled ? "#7fe2e3" : "#192537", marginBottom: 4, letterSpacing: "-0.01em", lineHeight: 1.1 }}>
              {stat.value}
            </div>
            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: "clamp(11px, 2.5vw, 13px)", color: stat.filled ? "white" : "#192537", marginBottom: 3 }}>
              {stat.label}
            </div>
            <div style={{ fontFamily: "Verdana, sans-serif", fontSize: "clamp(10px, 2vw, 11px)", color: stat.filled ? "rgba(255,255,255,0.45)" : "#7a8a9e" }}>
              {stat.sub}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AboutElysian() {
  return (
    <section style={{ background: "#f9f9f9", padding: "88px 0" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px" }}>

        {/* ════ DESKTOP LAYOUT (hidden on mobile) ════ */}
        <div className="ae-desktop" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 56, alignItems: "stretch" }}>

          {/* Left: house image — fills full height of grid row */}
          <HouseImage mobile={false} />

          {/* Right: heading + desc + boxes */}
          <div>
            <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e", letterSpacing: "0.28em", textTransform: "uppercase", margin: "0 0 14px" }}>
              About Elysian
            </p>
            <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: "clamp(26px, 3.2vw, 44px)", color: "#192537", margin: "0 0 20px", lineHeight: 1.12, letterSpacing: "-0.02em" }}>
              Dubai's most <span style={{ color: "#7fe2e3" }}>trusted</span> property partner
            </h2>
            <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", lineHeight: 1.85, margin: "0 0 36px", maxWidth: 440 }}>
              At Elysian, we believe finding your dream property should be effortless. With deep market expertise and a curated portfolio spanning every community in Dubai, we guide you from first enquiry through to handing over the keys — and beyond.
            </p>
            <StatBoxes />
          </div>
        </div>

        {/* ════ MOBILE LAYOUT (hidden on desktop) ════
             Order: heading → image → description → boxes              */}
        <div className="ae-mobile" style={{ display: "none", flexDirection: "column", gap: 32 }}>

          {/* 1. Heading */}
          <div>
            <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e", letterSpacing: "0.28em", textTransform: "uppercase", margin: "0 0 12px" }}>
              About Elysian
            </p>
            <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: "clamp(26px, 7vw, 36px)", color: "#192537", margin: 0, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
              Dubai's most <span style={{ color: "#7fe2e3" }}>trusted</span> property partner
            </h2>
          </div>

          {/* 2. House image — with house clip shape on mobile too */}
          <HouseImage mobile={true} />

          {/* 3. Description */}
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", lineHeight: 1.85, margin: 0 }}>
            At Elysian, we believe finding your dream property should be effortless. With deep market expertise and a curated portfolio spanning every community in Dubai, we guide you from first enquiry through to handing over the keys — and beyond.
          </p>

          {/* 4. Boxes */}
          <StatBoxes />
        </div>

      </div>

      <style>{`
        @media (max-width: 900px) {
          .ae-desktop { display: none !important; }
          .ae-mobile  { display: flex !important; }
        }

        /* Desktop: square boxes */
        @media (min-width: 901px) {
          .ae-box {
            aspect-ratio: 1 / 1 !important;
          }
        }

        /* Mobile: natural height, no aspect-ratio squeezing */
        @media (max-width: 900px) {
          .ae-box {
            aspect-ratio: unset !important;
            padding: 20px 18px !important;
            border-radius: 18px !important;
            min-height: 160px !important;
          }
          .ae-boxes {
            gap: 12px !important;
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 400px) {
          .ae-box {
            padding: 16px 14px !important;
            border-radius: 14px !important;
            min-height: 140px !important;
          }
        }
      `}</style>
    </section>
  );
}