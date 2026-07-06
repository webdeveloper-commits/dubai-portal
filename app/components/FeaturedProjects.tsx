"use client";
import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";

const projects = [
  {
    id: 1,
    name: "Sobha Hartland II",
    developer: "Sobha Realty",
    location: "Mohammed Bin Rashid City, Dubai",
    description:
      "An exclusive waterfront community featuring ultra-luxury villas and apartments surrounded by crystal-clear lagoons and lush greenery in the heart of Dubai.",
    image:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900&q=80",
    details: [
      { label: "Starting Price", value: "AED 1.8M" },
      { label: "Payment Plan", value: "60/40" },
      { label: "Handover", value: "Q4 2026" },
      { label: "Est. ROI", value: "7.2% p.a." },
    ],
  },
  {
    id: 2,
    name: "Creek Waters 2",
    developer: "Emaar Properties",
    location: "Dubai Creek Harbour",
    description:
      "Breathtaking residences overlooking Dubai Creek with panoramic views of the iconic skyline. A masterfully crafted community redefining waterfront living.",
    image:
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&q=80",
    details: [
      { label: "Starting Price", value: "AED 2.1M" },
      { label: "Payment Plan", value: "70/30" },
      { label: "Handover", value: "Q2 2027" },
      { label: "Est. ROI", value: "8.1% p.a." },
    ],
  },
  {
    id: 3,
    name: "Palm Jebel Ali",
    developer: "Nakheel",
    location: "Palm Jebel Ali, Dubai",
    description:
      "The world's largest man-made island reimagined. Ultra-exclusive beachfront villas with private pools offering an unparalleled lifestyle at the edge of the Arabian Gulf.",
    image:
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&q=80",
    details: [
      { label: "Starting Price", value: "AED 12M" },
      { label: "Payment Plan", value: "80/20" },
      { label: "Handover", value: "Q3 2027" },
      { label: "Est. ROI", value: "6.8% p.a." },
    ],
  },
  {
    id: 4,
    name: "Damac Lagoons",
    developer: "Damac Properties",
    location: "Hessa Street, Dubai",
    description:
      "Mediterranean-inspired townhouses and villas set around pristine lagoons with white sandy beaches. A resort-style community unlike anything else in Dubai.",
    image:
      "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=900&q=80",
    details: [
      { label: "Starting Price", value: "AED 1.4M" },
      { label: "Payment Plan", value: "65/35" },
      { label: "Handover", value: "Q1 2026" },
      { label: "Est. ROI", value: "7.5% p.a." },
    ],
  },
];

export default function FeaturedProjects() {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [dir, setDir] = useState<"left" | "right">("right");
  const touchStartX = useRef<number | null>(null);

  const go = (index: number, direction: "left" | "right") => {
    if (animating) return;
    setDir(direction);
    setAnimating(true);
    setTimeout(() => {
      setCurrent(index);
      setAnimating(false);
    }, 320);
  };

  const prev = () => go((current - 1 + projects.length) % projects.length, "left");
  const next = () => go((current + 1) % projects.length, "right");

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    touchStartX.current = null;
  };

  const p = projects[current];

  return (
    <section
      style={{
        background: "#f9f9f9",
        padding: "80px 0 72px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 32px",
        }}
      >
        {/* ── Section heading ── */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p
            style={{
              fontFamily: "Verdana, sans-serif",
              fontSize: 11,
              color: "#7a8a9e",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Featured Projects
          </p>
          <h2
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 500,
              fontSize: "clamp(30px, 4.5vw, 52px)",
              color: "#192537",
              lineHeight: 1.1,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Handpicked for You
          </h2>
        </div>

        {/* ── Three-column layout ── */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.15fr 1fr",
            gap: "40px",
            alignItems: "start",
            opacity: animating ? 0 : 1,
            transform: animating
              ? `translateX(${dir === "right" ? "-18px" : "18px"})`
              : "translateX(0)",
            transition: "opacity 0.32s ease, transform 0.32s ease",
          }}
          className="fp-grid"
        >

          {/* ── LEFT PANEL ── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
              paddingTop: 8,
            }}
          >
            {/* Tag */}
            <span
              style={{
                display: "inline-block",
                alignSelf: "flex-start",
                fontFamily: "Verdana, sans-serif",
                fontSize: 10,
                color: "#7fe2e3",
                background: "#192537",
                borderRadius: 999,
                padding: "4px 14px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                marginBottom: 18,
              }}
            >
              Off-Plan
            </span>

            {/* Project name */}
            <h3
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 500,
                fontSize: "clamp(22px, 2.8vw, 32px)",
                color: "#192537",
                lineHeight: 1.15,
                margin: "0 0 6px 0",
              }}
            >
              {p.name}
            </h3>

            {/* Developer + location */}
            <p
              style={{
                fontFamily: "Verdana, sans-serif",
                fontSize: 12,
                color: "#7fe2e3",
                marginBottom: 20,
                letterSpacing: "0.04em",
              }}
            >
              {p.developer} · {p.location}
            </p>

            {/* Description */}
            <p
              style={{
                fontFamily: "Verdana, sans-serif",
                fontSize: 13,
                color: "#7a8a9e",
                lineHeight: 1.85,
                marginBottom: 36,
              }}
            >
              {p.description}
            </p>

            {/* Discover button */}
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                alignSelf: "flex-start",
                background: "#192537",
                color: "#f9f9f9",
                border: "none",
                borderRadius: 999,
                padding: "13px 24px",
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                letterSpacing: "0.03em",
                transition: "background 0.2s, color 0.2s",
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.background = "#7fe2e3";
                b.style.color = "#192537";
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.background = "#192537";
                b.style.color = "#f9f9f9";
              }}
            >
              Discover Project
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "#7fe2e3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "background 0.2s",
                }}
              >
                <ArrowUpRight size={13} color="#192537" />
              </span>
            </button>
          </div>

          {/* ── CENTER — Image ── */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                borderRadius: 32,
                overflow: "hidden",
                aspectRatio: "3/4",
                width: "100%",
              }}
            >
              <img
                src={p.image}
                alt={p.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>

            {/* Counter badge on image */}
            <div
              style={{
                position: "absolute",
                bottom: 20,
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(25,37,55,0.75)",
                backdropFilter: "blur(10px)",
                borderRadius: 999,
                padding: "6px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {projects.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i, i > current ? "right" : "left")}
                  style={{
                    width: i === current ? 20 : 6,
                    height: 6,
                    borderRadius: 999,
                    background: i === current ? "#7fe2e3" : "rgba(255,255,255,0.35)",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    transition: "width 0.3s, background 0.3s",
                  }}
                />
              ))}
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div
            style={{
              paddingTop: 8,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Detail rows — like the reference: label bold, value below, then a divider */}
            {p.details.map((d, i) => (
              <div key={d.label}>
                <div style={{ padding: "18px 0" }}>
                  <p
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      fontSize: 15,
                      color: "#192537",
                      margin: "0 0 5px 0",
                    }}
                  >
                    {d.label}
                  </p>
                  <p
                    style={{
                      fontFamily: "Verdana, sans-serif",
                      fontSize: 13,
                      color: "#7a8a9e",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {d.value}
                  </p>
                </div>
                {/* Divider */}
                {i < p.details.length - 1 && (
                  <div
                    style={{
                      height: 1,
                      background: "#e2e8f0",
                    }}
                  />
                )}
              </div>
            ))}

            {/* Nav buttons — replaces the people avatars */}
            <div
              style={{
                marginTop: "auto",
                paddingTop: 32,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <button
                onClick={prev}
                aria-label="Previous project"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "1.5px solid #192537",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#192537";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <ChevronLeft size={18} color="#192537" />
              </button>

              <span
                style={{
                  fontFamily: "Verdana, sans-serif",
                  fontSize: 12,
                  color: "#7a8a9e",
                }}
              >
                {String(current + 1).padStart(2, "0")} /{" "}
                {String(projects.length).padStart(2, "0")}
              </span>

              <button
                onClick={next}
                aria-label="Next project"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "none",
                  background: "#192537",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#7fe2e3";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#192537";
                }}
              >
                <ChevronRight size={18} color="white" />
              </button>
            </div>
          </div>
        </div>

        {/* ── MOBILE NAV (hidden on desktop, shown on mobile) ── */}
        <div
          className="fp-mobile-nav"
          style={{
            display: "none",
            justifyContent: "center",
            alignItems: "center",
            gap: 14,
            marginTop: 28,
          }}
        >
          <button
            onClick={prev}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "1.5px solid #192537",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronLeft size={18} color="#192537" />
          </button>
          <span
            style={{
              fontFamily: "Verdana, sans-serif",
              fontSize: 12,
              color: "#7a8a9e",
            }}
          >
            {String(current + 1).padStart(2, "0")} /{" "}
            {String(projects.length).padStart(2, "0")}
          </span>
          <button
            onClick={next}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "none",
              background: "#192537",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronRight size={18} color="white" />
          </button>
        </div>
      </div>

      {/* ── Responsive styles ── */}
      <style>{`
        /* Hide right-panel nav on mobile, show mobile nav instead */
        @media (max-width: 900px) {
          .fp-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }

          /* Mobile order: image → left panel (name+desc) → right panel (details+btn) */
          .fp-grid > div:nth-child(1) { order: 2; }
          .fp-grid > div:nth-child(2) { order: 1; }
          .fp-grid > div:nth-child(3) { order: 3; }

          /* Hide desktop nav in right panel on mobile */
          .fp-grid > div:nth-child(3) > div:last-child {
            display: none !important;
          }

          .fp-mobile-nav {
            display: flex !important;
          }
        }
      `}</style>
    </section>
  );
}