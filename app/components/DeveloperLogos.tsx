"use client";
import Link from "next/link";

interface Dev {
  name: string;
  slug: string;
  logo_url: string | null;
}

export default function DeveloperLogos({ developers }: { developers: Dev[] }) {
  if (developers.length === 0) return null;

  // Duplicate list so the marquee loops seamlessly
  const items = [...developers, ...developers];

  return (
    <section style={{ background: "white", padding: "64px 0", borderTop: "1px solid #f0f2f5", borderBottom: "1px solid #f0f2f5", overflow: "hidden" }}>

      {/* Heading */}
      <div style={{ textAlign: "center", marginBottom: 44, padding: "0 24px" }}>
        <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.3em", textTransform: "uppercase", margin: "0 0 10px" }}>
          Our Partners
        </p>
        <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(22px, 3vw, 36px)", color: "#192537", margin: 0, letterSpacing: "-0.02em" }}>
          Trusted Developer Partners
        </h2>
      </div>

      {/* Marquee track */}
      <div style={{ position: "relative" }}>
        {/* Fade edges */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 120, background: "linear-gradient(to right, white, transparent)", zIndex: 2, pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 120, background: "linear-gradient(to left, white, transparent)", zIndex: 2, pointerEvents: "none" }} />

        <div className="dl-track">
          {items.map((dev, i) => (
            <Link
              key={`${dev.slug}-${i}`}
              href={`/developers/${dev.slug}`}
              className="dl-logo"
              style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 160, height: 80, borderRadius: 14, border: "1.5px solid #eef0f3", background: "#fafbfc", textDecoration: "none", transition: "all 0.25s", margin: "0 8px" }}
            >
              {dev.logo_url ? (
                <img
                  src={dev.logo_url}
                  alt={dev.name}
                  style={{ maxWidth: 110, maxHeight: 44, objectFit: "contain", display: "block", filter: "grayscale(100%)", opacity: 0.55, transition: "filter 0.25s, opacity 0.25s" }}
                  className="dl-img"
                />
              ) : (
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#7a8a9e", textAlign: "center", padding: "0 12px", lineHeight: 1.3, transition: "color 0.25s" }}>
                  {dev.name}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        .dl-track {
          display: flex;
          width: max-content;
          animation: dl-scroll 40s linear infinite;
        }
        .dl-track:hover { animation-play-state: paused; }

        .dl-logo:hover {
          border-color: rgba(127,226,227,0.5) !important;
          background: rgba(127,226,227,0.05) !important;
          box-shadow: 0 4px 18px rgba(127,226,227,0.12);
        }
        .dl-logo:hover .dl-img {
          filter: grayscale(0%) !important;
          opacity: 1 !important;
        }

        @keyframes dl-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
