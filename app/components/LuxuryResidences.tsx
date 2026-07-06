"use client";
import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";

const categories = ["All", "Apartment", "Villa"];

const residences = [
  {
    id: 1,
    category: "Villa",
    tag: "Ultra Premium",
    name: "Bulgari Residences",
    location: "Jumeira Bay Island, Dubai",
    price: "AED 45,000,000",
    beds: 5,
    type: "Villa",
    image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1400&q=85",
  },
  {
    id: 2,
    category: "Apartment",
    tag: "Branded Residence",
    name: "Armani Beach Residences",
    location: "Palm Jumeirah, Dubai",
    price: "AED 22,000,000",
    beds: 4,
    type: "Apartment",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1400&q=85",
  },
  {
    id: 3,
    category: "Villa",
    tag: "Ultra Premium",
    name: "Palm Jebel Ali Villas",
    location: "Palm Jebel Ali, Dubai",
    price: "AED 35,000,000",
    beds: 6,
    type: "Villa",
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1400&q=85",
  },
  {
    id: 4,
    category: "Apartment",
    tag: "Luxury",
    name: "W Residences Downtown",
    location: "Downtown Dubai",
    price: "AED 9,500,000",
    beds: 3,
    type: "Penthouse",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1400&q=85",
  },
  {
    id: 5,
    category: "Villa",
    tag: "Premium",
    name: "Six Senses Residences",
    location: "Palm Jumeirah, Dubai",
    price: "AED 38,500,000",
    beds: 5,
    type: "Villa",
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1400&q=85",
  },
];

export default function LuxuryResidences() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const list =
    activeCategory === "All"
      ? residences
      : residences.filter((r) => r.category === activeCategory);

  const total = list.length;
  const safeIndex = Math.min(currentIndex, total - 1);
  const item = list[safeIndex];

  /* ── fixed next bug: use safeIndex not currentIndex ── */
  const go = (idx: number) => {
    if (animating) return;
    const clamped = ((idx % total) + total) % total;
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex(clamped);
      setAnimating(false);
    }, 280);
  };

  const prev = () => go(safeIndex - 1);
  const next = () => go(safeIndex + 1);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setCurrentIndex(0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    touchStartX.current = null;
  };

  return (
    /* ── Dark brand-color section background ── */
    <section style={{ background: "#192537", padding: "72px 0 72px" }}>

      {/* ── Heading — on dark bg, white text ── */}
      <div style={{ textAlign: "center", marginBottom: 40, padding: "0 32px" }}>
        <p
          style={{
            fontFamily: "Verdana, sans-serif",
            fontSize: 11,
            color: "#7fe2e3",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            margin: "0 0 14px",
          }}
        >
          Ultra Premium
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
          Luxury &{" "}
          <span style={{ color: "#7fe2e3" }}>Branded Residences</span>
        </h2>
      </div>

      {/* ── Controls: pills left, nav right — also on dark bg ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          padding: "0 32px",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* Category pills — light style on dark bg */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                style={{
                  padding: "8px 22px",
                  borderRadius: 999,
                  border: `1.5px solid ${isActive ? "#7fe2e3" : "rgba(255,255,255,0.25)"}`,
                  background: isActive ? "#7fe2e3" : "transparent",
                  color: isActive ? "#192537" : "rgba(255,255,255,0.7)",
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 500,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.6)";
                    (e.currentTarget as HTMLButtonElement).style.color = "white";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.25)";
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)";
                  }
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Compact prev / count / next */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={prev}
            aria-label="Previous"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "1.5px solid rgba(255,255,255,0.3)",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.15)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "white";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.3)";
            }}
          >
            <ChevronLeft size={17} color="white" />
          </button>

          <span
            style={{
              fontFamily: "Verdana, sans-serif",
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
              minWidth: 44,
              textAlign: "center",
            }}
          >
            {String(safeIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>

          <button
            onClick={next}
            aria-label="Next"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "none",
              background: "#7fe2e3",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "white";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#7fe2e3";
            }}
          >
            <ChevronRight size={17} color="#192537" />
          </button>
        </div>
      </div>

      {/* ── Image wrapper: margin 16px on all sides so dark bg peeks ── */}
      <div style={{ padding: "0 16px" }}>
        <div
          className="lr-slider"
          style={{
            position: "relative",
            borderRadius: 32,
            overflow: "hidden",
            height: 580,
            opacity: animating ? 0 : 1,
            transition: "opacity 0.28s ease",
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Background image */}
          <img
            src={item.image}
            alt={item.name}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />

          {/* Subtle vignette — stronger bottom-left so card pops */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(130deg, rgba(13,26,39,0.45) 0%, rgba(13,26,39,0.05) 50%, rgba(13,26,39,0.0) 100%)",
              pointerEvents: "none",
            }}
          />

          {/* ── Floating glass card — top right ── */}
          <div
            className="lr-glass-card"
            style={{
              position: "absolute",
              top: 28,
              right: 28,
              width: 280,
              borderRadius: 20,
              background: "rgba(25, 37, 55, 0.62)",
              backdropFilter: "blur(28px)",
              WebkitBackdropFilter: "blur(28px)",
              border: "1px solid rgba(255,255,255,0.16)",
              boxShadow: "0 16px 56px rgba(0,0,0,0.35)",
              padding: "22px 20px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Tag */}
            <span
              style={{
                fontFamily: "Verdana, sans-serif",
                fontSize: 9,
                color: "#7fe2e3",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                marginBottom: 5,
                display: "block",
              }}
            >
              {item.tag}
            </span>

            {/* Name */}
            <h3
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 500,
                fontSize: 18,
                color: "white",
                margin: "0 0 14px",
                lineHeight: 1.25,
              }}
            >
              {item.name}
            </h3>

            <div style={{ height: 1, background: "rgba(255,255,255,0.15)", marginBottom: 12 }} />

            {/* Location label */}
            <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.14em", margin: "0 0 4px" }}>
              Location
            </p>
            <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: 13, color: "white", margin: "0 0 12px" }}>
              {item.location}
            </p>

            <div style={{ height: 1, background: "rgba(255,255,255,0.15)", marginBottom: 12 }} />

            {/* Bedrooms + Type */}
            <div style={{ display: "flex", marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.14em", margin: "0 0 3px" }}>Bedrooms</p>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: 14, color: "white", margin: 0 }}>{item.beds} BR</p>
              </div>
              <div style={{ width: 1, background: "rgba(255,255,255,0.15)", margin: "0 12px" }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.14em", margin: "0 0 3px" }}>Type</p>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: 14, color: "white", margin: 0 }}>{item.type}</p>
              </div>
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.15)", marginBottom: 12 }} />

            {/* Price */}
            <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: 16, color: "#7fe2e3", margin: "0 0 16px" }}>
              {item.price}
            </p>

            {/* Discover More button */}
            <button
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                padding: "11px 16px",
                borderRadius: 999,
                border: "none",
                background: "#192537",
                color: "white",
                fontFamily: "Montserrat, sans-serif",
                fontWeight: 500,
                fontSize: 13,
                cursor: "pointer",
                letterSpacing: "0.02em",
                transition: "background 0.2s, color 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#7fe2e3";
                (e.currentTarget as HTMLButtonElement).style.color = "#192537";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#192537";
                (e.currentTarget as HTMLButtonElement).style.color = "white";
              }}
            >
              Discover More
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "#7fe2e3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ArrowUpRight size={11} color="#192537" />
              </span>
            </button>
          </div>

          {/* ── Dot indicators ── */}
          <div
            style={{
              position: "absolute",
              bottom: 22,
              left: 24,
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            {list.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                style={{
                  width: i === safeIndex ? 22 : 7,
                  height: 7,
                  borderRadius: 999,
                  background: i === safeIndex ? "#7fe2e3" : "rgba(255,255,255,0.35)",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  transition: "width 0.3s ease, background 0.3s ease",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile styles ── */}
      <style>{`
        @media (max-width: 768px) {
          .lr-slider {
            height: auto !important;
            border-radius: 20px !important;
          }

          /* Image sits at top, fixed height */
          .lr-slider img {
            position: relative !important;
            height: 260px !important;
            width: 100% !important;
            object-fit: cover !important;
          }

          /* Card drops below image, full width, solid dark */
          .lr-glass-card {
            position: relative !important;
            top: auto !important;
            right: auto !important;
            width: 100% !important;
            border-radius: 0 0 20px 20px !important;
            background: rgba(13, 26, 39, 0.96) !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border: none !important;
            border-top: 1px solid rgba(255,255,255,0.1) !important;
            box-shadow: none !important;
            padding: 20px 18px !important;
          }
        }

        @media (max-width: 480px) {
          .lr-slider img {
            height: 220px !important;
          }
        }
      `}</style>
    </section>
  );
}