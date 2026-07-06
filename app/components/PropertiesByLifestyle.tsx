"use client";
import { useState, useRef } from "react";
import { ArrowUpRight } from "lucide-react";

const lifestyles = [
  {
    id: "waterfront",
    label: "Waterfront",
    description: "Shimmering canal and creek views from your doorstep.",
    count: 87,
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=85",
  },
  {
    id: "golf",
    label: "Near Golf Course",
    description: "Manicured fairways and green living in one address.",
    count: 54,
    image: "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=900&q=85",
  },
  {
    id: "luxury",
    label: "Luxury Properties",
    description: "Bespoke finishes and panoramic views at every turn.",
    count: 142,
    image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900&q=85",
  },
  {
    id: "branded",
    label: "Branded Residences",
    description: "Live under the signature of the world's iconic brands.",
    count: 38,
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=900&q=85",
  },
  {
    id: "beachfront",
    label: "Beachfront",
    description: "Step from your door onto pristine white sand.",
    count: 61,
    image: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=900&q=85",
  },
  {
    id: "community",
    label: "Community Living",
    description: "Family-friendly gated communities with parks and retail.",
    count: 203,
    image: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=900&q=85",
  },
];

export default function PropertiesByLifestyle() {
  const [active, setActive] = useState<string>("luxury");
  const touchStartX = useRef<number | null>(null);
  const [mobileIndex, setMobileIndex] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 48) {
      if (diff > 0) setMobileIndex((i) => Math.min(i + 1, lifestyles.length - 1));
      else setMobileIndex((i) => Math.max(i - 1, 0));
    }
    touchStartX.current = null;
  };

  return (
    <section style={{ background: "#192537", padding: "80px 0" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px" }}>

        {/* ── Heading ── */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <p style={{
            fontFamily: "Verdana, sans-serif",
            fontSize: 11,
            color: "#7fe2e3",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            margin: "0 0 14px",
          }}>
            Find Your Fit
          </p>
          <h2 style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 500,
            fontSize: "clamp(26px, 4vw, 48px)",
            color: "white",
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}>
            Properties by{" "}
            <span style={{ color: "#7fe2e3" }}>Lifestyle</span>
          </h2>
        </div>

        {/* ── Desktop: expanding panels ── */}
        <div
          className="pbl-desktop"
          style={{
            display: "flex",
            gap: 10,
            height: 500,
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          {lifestyles.map((item) => {
            const isActive = active === item.id;
            return (
              <div
                key={item.id}
                onMouseEnter={() => setActive(item.id)}
                style={{
                  flex: isActive ? "4 1 0" : "1 1 0",
                  position: "relative",
                  borderRadius: 20,
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                  minWidth: 0,
                }}
              >
                {/* Image */}
                <img
                  src={item.image}
                  alt={item.label}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    transition: "transform 0.5s ease",
                    transform: isActive ? "scale(1.04)" : "scale(1.08)",
                  }}
                />

                {/* Dark gradient overlay — always present */}
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: isActive
                    ? "linear-gradient(0deg, rgba(25,37,55,0.88) 0%, rgba(25,37,55,0.2) 55%, rgba(25,37,55,0.05) 100%)"
                    : "linear-gradient(0deg, rgba(25,37,55,0.75) 0%, rgba(25,37,55,0.45) 100%)",
                  transition: "background 0.4s",
                }} />

                {/* Arrow button — top right, only on active */}
                {isActive && (
                  <a
                    href={`/properties?lifestyle=${item.id}`}
                    style={{
                      position: "absolute",
                      top: 20,
                      right: 20,
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textDecoration: "none",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                      transition: "background 0.2s",
                      zIndex: 2,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background = "#7fe2e3";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background = "white";
                    }}
                  >
                    <ArrowUpRight size={18} color="#192537" />
                  </a>
                )}

                {/* Bottom content */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: isActive ? "28px 24px" : "20px 16px",
                    transition: "padding 0.4s",
                    zIndex: 2,
                  }}
                >
                  {/* Collapsed: vertical label */}
                  {!isActive && (
                    <div style={{
                      writingMode: "vertical-rl",
                      textOrientation: "mixed",
                      transform: "rotate(180deg)",
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 500,
                      fontSize: 13,
                      color: "rgba(255,255,255,0.75)",
                      letterSpacing: "0.04em",
                      userSelect: "none",
                    }}>
                      {item.label}
                    </div>
                  )}

                  {/* Expanded: full info */}
                  {isActive && (
                    <div style={{
                      opacity: 1,
                      animation: "fadeInUp 0.3s ease 0.1s both",
                    }}>
                      {/* Count row */}
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}>
                        <div style={{ width: 20, height: 2, background: "#7fe2e3", borderRadius: 2 }} />
                        <span style={{
                          fontFamily: "Verdana, sans-serif",
                          fontSize: 11,
                          color: "#7fe2e3",
                          letterSpacing: "0.06em",
                        }}>
                          {item.count} Properties
                        </span>
                      </div>

                      {/* Name */}
                      <h3 style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 500,
                        fontSize: "clamp(20px, 2.5vw, 28px)",
                        color: "white",
                        margin: "0 0 8px",
                        lineHeight: 1.2,
                      }}>
                        {item.label}
                      </h3>

                      {/* Description */}
                      <p style={{
                        fontFamily: "Verdana, sans-serif",
                        fontSize: 13,
                        color: "rgba(255,255,255,0.65)",
                        margin: 0,
                        lineHeight: 1.65,
                        maxWidth: 320,
                      }}>
                        {item.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Mobile: stacked card with swipe ── */}
        <div
          className="pbl-mobile"
          style={{ display: "none" }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Card */}
          <div style={{
            position: "relative",
            borderRadius: 24,
            overflow: "hidden",
            height: 420,
          }}>
            <img
              src={lifestyles[mobileIndex].image}
              alt={lifestyles[mobileIndex].label}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(0deg, rgba(25,37,55,0.92) 0%, rgba(25,37,55,0.2) 60%, rgba(25,37,55,0.05) 100%)",
            }} />

            {/* Arrow link */}
            <a
              href={`/properties?lifestyle=${lifestyles[mobileIndex].id}`}
              style={{
                position: "absolute", top: 20, right: 20,
                width: 44, height: 44, borderRadius: 12,
                background: "white", display: "flex",
                alignItems: "center", justifyContent: "center",
                textDecoration: "none", zIndex: 2,
              }}
            >
              <ArrowUpRight size={18} color="#192537" />
            </a>

            {/* Content */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "28px 24px", zIndex: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 20, height: 2, background: "#7fe2e3", borderRadius: 2 }} />
                <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7fe2e3", letterSpacing: "0.06em" }}>
                  {lifestyles[mobileIndex].count} Properties
                </span>
              </div>
              <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: 26, color: "white", margin: "0 0 8px", lineHeight: 1.2 }}>
                {lifestyles[mobileIndex].label}
              </h3>
              <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.65)", margin: 0, lineHeight: 1.65 }}>
                {lifestyles[mobileIndex].description}
              </p>
            </div>
          </div>

          {/* Dot indicators + swipe hint */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20 }}>
            {lifestyles.map((_, i) => (
              <button
                key={i}
                onClick={() => setMobileIndex(i)}
                style={{
                  width: i === mobileIndex ? 22 : 7,
                  height: 7,
                  borderRadius: 999,
                  background: i === mobileIndex ? "#7fe2e3" : "rgba(255,255,255,0.25)",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  transition: "width 0.3s, background 0.3s",
                }}
              />
            ))}
          </div>

          {/* Lifestyle pills — tap to jump */}
          <div style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
            marginTop: 16,
          }}>
            {lifestyles.map((item, i) => (
              <button
                key={item.id}
                onClick={() => setMobileIndex(i)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 999,
                  border: `1.5px solid ${i === mobileIndex ? "#7fe2e3" : "rgba(255,255,255,0.2)"}`,
                  background: i === mobileIndex ? "#7fe2e3" : "transparent",
                  color: i === mobileIndex ? "#192537" : "rgba(255,255,255,0.6)",
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 500,
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .pbl-desktop { display: none !important; }
          .pbl-mobile  { display: block !important; }
        }
      `}</style>
    </section>
  );
}