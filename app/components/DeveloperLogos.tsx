"use client";
import Link from "next/link";

interface Dev {
  name: string;
  slug: string;
  logo_url: string | null;
}

const WHY_STATS = [
  {
    icon: "📈",
    value: "6–8%",
    label: "Average ROI",
    desc: "Among the highest rental yields of any global city — consistently outperforming London, New York and Singapore.",
  },
  {
    icon: "🏛️",
    value: "0%",
    label: "Tax on Property",
    desc: "No income tax, no capital gains tax, no inheritance tax. Keep 100% of what you earn.",
  },
  {
    icon: "🌍",
    value: "100%",
    label: "Foreign Ownership",
    desc: "Expats can own freehold property outright in designated zones — no local sponsor required.",
  },
  {
    icon: "🛂",
    value: "10 yr",
    label: "UAE Golden Visa",
    desc: "Invest AED 2M+ in property and qualify for a 10-year renewable UAE residency visa.",
  },
];

export default function DeveloperLogos({ developers }: { developers: Dev[] }) {
  const items = developers.length > 0 ? [...developers, ...developers] : [];

  return (
    <section style={{ background: "white", borderTop: "1px solid #f0f2f5" }}>

      {/* ── Why Invest in Dubai ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "72px 28px 64px" }}>

        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.3em", textTransform: "uppercase", margin: "0 0 12px" }}>
            Real Estate Investment
          </p>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(24px, 3.2vw, 40px)", color: "#192537", margin: "0 0 14px", letterSpacing: "-0.02em" }}>
            Why Invest in <span style={{ color: "#7fe2e3" }}>Dubai?</span>
          </h2>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", maxWidth: 520, margin: "0 auto", lineHeight: 1.8 }}>
            Dubai offers unmatched returns, zero taxation and world-class infrastructure — making it the #1 destination for global property investors.
          </p>
        </div>

        {/* Stat cards */}
        <div className="wi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          {WHY_STATS.map((s) => (
            <div key={s.label} className="wi-card"
              style={{ background: "#f8fafc", borderRadius: 18, padding: "28px 24px", border: "1.5px solid #eef0f3", transition: "all 0.25s" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(127,226,227,0.5)"; el.style.background = "rgba(127,226,227,0.04)"; el.style.transform = "translateY(-3px)"; el.style.boxShadow = "0 8px 28px rgba(127,226,227,0.12)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#eef0f3"; el.style.background = "#f8fafc"; el.style.transform = "translateY(0)"; el.style.boxShadow = "none"; }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(127,226,227,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 18 }}>
                {s.icon}
              </div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, color: "#192537", marginBottom: 4, letterSpacing: "-0.03em", lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12, color: "#7fe2e3", marginBottom: 10, letterSpacing: "0.03em" }}>
                {s.label}
              </div>
              <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e", lineHeight: 1.75, margin: 0 }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>

      </div>

      {/* ── Developer logos strip ── */}
      {items.length > 0 && (
        <div style={{ borderTop: "1px solid #f0f2f5", padding: "32px 0 36px", overflow: "hidden", background: "#fafbfc" }}>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#bbb", letterSpacing: "0.25em", textTransform: "uppercase", textAlign: "center", margin: "0 0 24px" }}>
            Trusted Developer Partners
          </p>

          {/* Marquee */}
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 100, background: "linear-gradient(to right, #fafbfc, transparent)", zIndex: 2, pointerEvents: "none" }} />
            <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 100, background: "linear-gradient(to left, #fafbfc, transparent)", zIndex: 2, pointerEvents: "none" }} />

            <div className="dl-track">
              {items.map((dev, i) => (
                <Link key={`${dev.slug}-${i}`} href={`/developers/${dev.slug}`} className="dl-logo"
                  style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 150, height: 64, borderRadius: 12, border: "1.5px solid #edf0f3", background: "white", textDecoration: "none", transition: "all 0.25s", margin: "0 8px" }}
                >
                  {dev.logo_url ? (
                    <img src={dev.logo_url} alt={dev.name}
                      style={{ maxWidth: 100, maxHeight: 36, objectFit: "contain", display: "block", filter: "grayscale(100%)", opacity: 0.45, transition: "filter 0.25s, opacity 0.25s" }}
                      className="dl-img"
                    />
                  ) : (
                    <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, fontSize: 11, color: "#aaa", textAlign: "center", padding: "0 10px", lineHeight: 1.3 }}>
                      {dev.name}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .wi-grid { }
        @media (max-width: 900px) { .wi-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 480px) { .wi-grid { grid-template-columns: 1fr !important; } }

        .dl-track {
          display: flex;
          width: max-content;
          animation: dl-scroll 38s linear infinite;
        }
        .dl-track:hover { animation-play-state: paused; }
        .dl-logo:hover { border-color: rgba(127,226,227,0.55) !important; box-shadow: 0 3px 14px rgba(127,226,227,0.1); }
        .dl-logo:hover .dl-img { filter: grayscale(0%) !important; opacity: 1 !important; }

        @keyframes dl-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
