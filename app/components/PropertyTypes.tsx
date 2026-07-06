"use client";
import { useRef } from "react";

const types = [
  {
    id: "commercial",
    label: "Commercial",
    count: 83,
    icon: (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        {/* Main tall building */}
        <rect x="5" y="8" width="22" height="32" rx="2" stroke="currentColor" strokeWidth="1.8"/>
        {/* Side shorter building */}
        <rect x="27" y="18" width="12" height="22" rx="2" stroke="currentColor" strokeWidth="1.8"/>
        {/* Windows left building */}
        <rect x="9" y="13" width="5" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="18" y="13" width="5" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="9" y="22" width="5" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="18" y="22" width="5" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="9" y="31" width="5" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="18" y="31" width="5" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.4"/>
        {/* Windows right building */}
        <rect x="30" y="22" width="4" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="30" y="30" width="4" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    id: "villa",
    label: "Villa",
    count: 128,
    icon: (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        {/* Roof */}
        <path d="M5 22L22 8L39 22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Body */}
        <rect x="9" y="22" width="26" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
        {/* Door */}
        <rect x="18" y="28" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        {/* Left window */}
        <rect x="11" y="25" width="5" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.4"/>
        {/* Right window */}
        <rect x="28" y="25" width="5" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.4"/>
        {/* Chimney */}
        <rect x="28" y="11" width="3.5" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
  },
  {
    id: "apartment",
    label: "Apartment",
    count: 342,
    icon: (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        {/* Main building */}
        <rect x="7" y="10" width="30" height="30" rx="2" stroke="currentColor" strokeWidth="1.8"/>
        {/* Roof line detail */}
        <path d="M7 16h30" stroke="currentColor" strokeWidth="1.3" opacity="0.5"/>
        {/* Floor 1 windows */}
        <rect x="12" y="19" width="6" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="26" y="19" width="6" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.4"/>
        {/* Floor 2 windows */}
        <rect x="12" y="28" width="6" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="26" y="28" width="6" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.4"/>
        {/* Centre door */}
        <rect x="19" y="32" width="6" height="8" rx="0.8" stroke="currentColor" strokeWidth="1.5"/>
        {/* Antenna */}
        <line x1="22" y1="10" x2="22" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="19" y1="7.5" x2="25" y2="7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "penthouse",
    label: "Penthouse",
    count: 47,
    icon: (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        {/* Building */}
        <rect x="8" y="18" width="28" height="22" rx="2" stroke="currentColor" strokeWidth="1.8"/>
        {/* Penthouse top floor */}
        <rect x="14" y="10" width="16" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
        {/* Connecting line */}
        <line x1="8" y1="18" x2="14" y2="18" stroke="currentColor" strokeWidth="1.8"/>
        <line x1="30" y1="18" x2="36" y2="18" stroke="currentColor" strokeWidth="1.8"/>
        {/* Top floor windows */}
        <rect x="17" y="13" width="4" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="23" y="13" width="4" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.3"/>
        {/* Main windows */}
        <rect x="12" y="23" width="6" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="26" y="23" width="6" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.4"/>
        {/* Stars / luxury dots above */}
        <circle cx="22" cy="6" r="1" fill="currentColor"/>
        <circle cx="18" cy="7.5" r="0.7" fill="currentColor" opacity="0.6"/>
        <circle cx="26" cy="7.5" r="0.7" fill="currentColor" opacity="0.6"/>
      </svg>
    ),
  },
  {
    id: "townhouse",
    label: "Townhouse",
    count: 94,
    icon: (
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        {/* Left unit */}
        <rect x="4" y="18" width="16" height="20" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M4 18L12 9L20 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Right unit (taller) */}
        <rect x="24" y="14" width="16" height="24" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M24 14L32 5L40 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Left door */}
        <rect x="9" y="28" width="5" height="10" rx="0.8" stroke="currentColor" strokeWidth="1.4"/>
        {/* Right door */}
        <rect x="29" y="28" width="5" height="10" rx="0.8" stroke="currentColor" strokeWidth="1.4"/>
        {/* Left window */}
        <rect x="7" y="21" width="5" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.3"/>
        {/* Right window */}
        <rect x="31" y="18" width="5" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
];

export default function PropertyTypes() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section
      style={{
        background: "#192537",
        padding: "90px 0 80px",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px" }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <p
            style={{
              fontFamily: "Verdana, sans-serif",
              fontSize: 11,
              color: "#7fe2e3",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Property By Requirement
          </p>
          <h2
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 500,
              fontSize: "clamp(28px, 4.5vw, 52px)",
              color: "white",
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            Explore Property{" "}
            <span style={{ color: "#7fe2e3" }}>Types</span>
          </h2>
        </div>

        {/* ── Cards ── */}
        <div
          ref={scrollRef}
          className="pt-scroll"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 16,
          }}
        >
          {types.map((type) => (
            <button
              key={type.id}
              className="pt-card"
              style={{
                /* reset */
                appearance: "none",
                WebkitAppearance: "none",
                /* layout */
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0,
                /* spacing */
                padding: "40px 20px 32px",
                /* look */
                background: "rgba(255,255,255,0.03)",
                border: "1.5px solid rgba(255,255,255,0.1)",
                borderRadius: 20,
                cursor: "pointer",
                /* transition */
                transition: "border-color 0.25s, background 0.25s, transform 0.2s",
                /* text reset */
                textAlign: "center",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = "#7fe2e3";
                el.style.background = "rgba(127,226,227,0.07)";
                el.style.transform = "translateY(-4px)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = "rgba(255,255,255,0.1)";
                el.style.background = "rgba(255,255,255,0.03)";
                el.style.transform = "translateY(0)";
              }}
            >
              {/* Icon box */}
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.06)",
                  border: "1.5px solid rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 24,
                  color: "rgba(255,255,255,0.75)",
                  transition: "background 0.25s, border-color 0.25s, color 0.25s",
                }}
                className="pt-icon-box"
              >
                {type.icon}
              </div>

              {/* Label */}
              <span
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 17,
                  color: "white",
                  display: "block",
                  marginBottom: 8,
                  letterSpacing: "-0.01em",
                }}
              >
                {type.label}
              </span>

              {/* Count */}
              <span
                style={{
                  fontFamily: "Verdana, sans-serif",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                {type.count} Properties
              </span>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        /* Hover: teal icon box */
        .pt-card:hover .pt-icon-box {
          background: rgba(127, 226, 227, 0.12);
          border-color: rgba(127, 226, 227, 0.35);
          color: #7fe2e3;
        }

        /* ── Mobile: horizontal scroll ── */
        @media (max-width: 900px) {
          .pt-scroll {
            display: flex !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            scroll-snap-type: x mandatory !important;
            -webkit-overflow-scrolling: touch !important;
            padding-bottom: 12px !important;
            gap: 12px !important;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .pt-scroll::-webkit-scrollbar { display: none; }

          .pt-card {
            flex: 0 0 auto !important;
            width: 160px !important;
            scroll-snap-align: start;
            padding: 28px 16px 24px !important;
          }

          .pt-icon-box {
            width: 60px !important;
            height: 60px !important;
            margin-bottom: 16px !important;
          }
        }

        @media (max-width: 480px) {
          .pt-card {
            width: 148px !important;
          }
        }
      `}</style>
    </section>
  );
}