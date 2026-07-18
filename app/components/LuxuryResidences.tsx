"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";

interface Project {
  id: string;
  name: string;
  slug: string;
  area: string;
  priceFrom: number;
  propertyTypes: string[];
  bedrooms: string;
  image: string;
  tag?: string;
}

function fmt(n: number) {
  if (n >= 1_000_000) return "AED " + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000)     return "AED " + (n / 1_000).toFixed(0) + "K";
  return "AED " + n;
}

const TYPE_LABELS = ["Apartment", "Villa", "Townhouse", "Penthouse"];

export default function LuxuryResidences({ projects }: { projects: Project[] }) {
  const validProjects = projects.filter(p => p.image && !p.image.includes("unsplash"));

  const cats = ["All", ...TYPE_LABELS.filter(t =>
    validProjects.some(p => p.propertyTypes.some(pt => pt.toLowerCase() === t.toLowerCase()))
  )];

  const [activeCategory, setActiveCategory] = useState("All");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const list = activeCategory === "All"
    ? validProjects
    : validProjects.filter(p => p.propertyTypes.some(pt => pt.toLowerCase() === activeCategory.toLowerCase()));

  const total = list.length;
  const safeIndex = Math.min(currentIndex, Math.max(0, total - 1));
  const item = list[safeIndex];

  const go = (idx: number) => {
    if (animating || total === 0) return;
    const clamped = ((idx % total) + total) % total;
    setAnimating(true);
    setTimeout(() => { setCurrentIndex(clamped); setAnimating(false); }, 300);
  };

  const prev = () => go(safeIndex - 1);
  const next = () => go(safeIndex + 1);

  const handleCategoryChange = (cat: string) => { setActiveCategory(cat); setCurrentIndex(0); };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    touchStartX.current = null;
  };

  if (!item) return null;

  const typeLabel = item.propertyTypes[0]
    ? item.propertyTypes[0].charAt(0).toUpperCase() + item.propertyTypes[0].slice(1)
    : "Property";

  return (
    <section style={{ background: "#0d1e2e", paddingBottom: 0 }}>

      {/* ── Header ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "72px 28px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 28 }}>

          {/* Title */}
          <div>
            <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.3em", textTransform: "uppercase", margin: "0 0 10px" }}>
              Our Portfolio
            </p>
            <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(26px, 3.5vw, 46px)", color: "white", margin: 0, lineHeight: 1.08, letterSpacing: "-0.025em" }}>
              Luxury &{" "}<span style={{ color: "#7fe2e3" }}>Off-Plan Projects</span>
            </h2>
          </div>

          {/* Counter + arrows */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 6 }}>
            <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", minWidth: 52, textAlign: "center" }}>
              {String(safeIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
            <button onClick={prev} aria-label="Previous"
              style={{ width: 42, height: 42, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.18)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
            >
              <ChevronLeft size={16} color="white" />
            </button>
            <button onClick={next} aria-label="Next"
              style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: "#7fe2e3", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "white"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#7fe2e3"; }}
            >
              <ChevronRight size={16} color="#192537" />
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {cats.map(cat => {
            const isActive = activeCategory === cat;
            return (
              <button key={cat} onClick={() => handleCategoryChange(cat)}
                style={{ padding: "7px 20px", borderRadius: 999, border: `1.5px solid ${isActive ? "#7fe2e3" : "rgba(255,255,255,0.13)"}`, background: isActive ? "#7fe2e3" : "transparent", color: isActive ? "#0d1e2e" : "rgba(255,255,255,0.5)", fontFamily: "Montserrat, sans-serif", fontWeight: isActive ? 700 : 400, fontSize: 12, cursor: "pointer", transition: "all 0.2s", letterSpacing: "0.02em" }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"; e.currentTarget.style.color = "white"; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.13)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; } }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Full-bleed slider ── */}
      <div className="lr-slider"
        style={{ position: "relative", height: 600, opacity: animating ? 0 : 1, transition: "opacity 0.3s ease", overflow: "hidden" }}
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
      >
        <img src={item.image} alt={item.name}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />

        {/* Bottom gradient — strong for text legibility */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(13,26,39,0.98) 0%, rgba(13,26,39,0.72) 30%, rgba(13,26,39,0.12) 60%, transparent 100%)", pointerEvents: "none" }} />
        {/* Subtle left fade */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(13,26,39,0.35) 0%, transparent 35%)", pointerEvents: "none" }} />

        {/* Left arrow (on image) */}
        <button onClick={prev} className="lr-arrow"
          style={{ position: "absolute", left: 20, top: "42%", transform: "translateY(-50%)", width: 52, height: 52, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.28)", background: "rgba(13,26,39,0.55)", backdropFilter: "blur(10px)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.22s", zIndex: 10 }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(127,226,227,0.18)"; e.currentTarget.style.borderColor = "#7fe2e3"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(13,26,39,0.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)"; }}
        >
          <ChevronLeft size={20} color="white" />
        </button>

        {/* Right arrow (on image) */}
        <button onClick={next} className="lr-arrow"
          style={{ position: "absolute", right: 20, top: "42%", transform: "translateY(-50%)", width: 52, height: 52, borderRadius: "50%", border: "none", background: "#7fe2e3", backdropFilter: "blur(10px)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.22s", zIndex: 10 }}
          onMouseEnter={e => { e.currentTarget.style.background = "white"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#7fe2e3"; }}
        >
          <ChevronRight size={20} color="#0d1e2e" />
        </button>

        {/* Bottom content */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 5 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px 32px" }}>

            {/* Badge */}
            {item.tag && (
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "#7fe2e3", letterSpacing: "0.28em", textTransform: "uppercase", background: "rgba(127,226,227,0.1)", border: "1px solid rgba(127,226,227,0.35)", borderRadius: 999, padding: "4px 14px" }}>
                  {item.tag}
                </span>
              </div>
            )}

            {/* Project name */}
            <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(22px, 3.5vw, 44px)", color: "white", margin: "0 0 10px", lineHeight: 1.08, letterSpacing: "-0.025em" }}>
              {item.name}
            </h3>

            {/* Location */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 24 }}>
              <MapPin size={13} color="#7fe2e3" style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                {item.area}
              </span>
            </div>

            {/* Stats row */}
            <div className="lr-stats" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0 }}>

              {item.bedrooms && (
                <div className="lr-stat" style={{ paddingRight: 22 }}>
                  <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "rgba(255,255,255,0.38)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>Bedrooms</div>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "white" }}>{item.bedrooms}</div>
                </div>
              )}
              {item.bedrooms && <div className="lr-divider" style={{ width: 1, height: 34, background: "rgba(255,255,255,0.13)", marginRight: 22 }} />}

              <div className="lr-stat" style={{ paddingRight: 22 }}>
                <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "rgba(255,255,255,0.38)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>Type</div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "white" }}>{typeLabel}</div>
              </div>

              {item.priceFrom > 0 && (
                <>
                  <div className="lr-divider" style={{ width: 1, height: 34, background: "rgba(255,255,255,0.13)", marginRight: 22 }} />
                  <div className="lr-stat" style={{ paddingRight: 28 }}>
                    <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "rgba(255,255,255,0.38)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>Starting from</div>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "#7fe2e3" }}>{fmt(item.priceFrom)}</div>
                  </div>
                  <div className="lr-divider" style={{ width: 1, height: 34, background: "rgba(255,255,255,0.13)", marginRight: 28 }} />
                </>
              )}

              <Link href={`/projects/${item.slug}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 26px", borderRadius: 999, background: "#7fe2e3", color: "#0d1e2e", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, textDecoration: "none", transition: "background 0.2s", whiteSpace: "nowrap" }}
                onMouseEnter={e => { e.currentTarget.style.background = "white"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#7fe2e3"; }}
              >
                View Project
                <ChevronRight size={14} color="#0d1e2e" />
              </Link>
            </div>

          </div>
        </div>
      </div>

      {/* ── Thumbnail strip ── */}
      {list.length > 1 && (
        <div style={{ background: "#091525", padding: "14px 0 0" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px" }}>
            <div className="lr-thumbs" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 20 }}>
              {list.map((p, i) => {
                const active = i === safeIndex;
                return (
                  <button key={p.id} onClick={() => go(i)}
                    style={{ flexShrink: 0, width: 108, height: 70, borderRadius: 10, overflow: "hidden", padding: 0, cursor: "pointer", border: `2px solid ${active ? "#7fe2e3" : "transparent"}`, transition: "all 0.28s", opacity: active ? 1 : 0.38, filter: active ? "none" : "grayscale(55%)" }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.opacity = "0.72"; e.currentTarget.style.filter = "none"; } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.opacity = "0.38"; e.currentTarget.style.filter = "grayscale(55%)"; } }}
                  >
                    <img src={p.image} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .lr-thumbs::-webkit-scrollbar { display: none; }
        .lr-thumbs { scrollbar-width: none; }
        @media (max-width: 768px) {
          .lr-slider { height: 480px !important; }
          .lr-arrow   { display: none !important; }
          .lr-divider { display: none !important; }
          .lr-stats   { gap: 10px !important; flex-direction: column; align-items: flex-start !important; }
          .lr-stat    { padding-right: 0 !important; }
        }
        @media (max-width: 480px) {
          .lr-slider { height: 380px !important; }
        }
      `}</style>
    </section>
  );
}
