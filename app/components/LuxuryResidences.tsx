"use client";
import { useState } from "react";
import Link from "next/link";
import { MapPin, ArrowUpRight } from "lucide-react";

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

const TAG_STYLE: Record<string, { bg: string; color: string }> = {
  "Off-Plan":   { bg: "#192537",  color: "#7fe2e3" },
  "Ready":      { bg: "#0f7a7b",  color: "white"   },
  "New Launch": { bg: "#f97316",  color: "white"   },
};

function ProjectCard({ p }: { p: Project }) {
  const tag = p.tag ? (TAG_STYLE[p.tag] ?? TAG_STYLE["Off-Plan"]) : null;
  const typeLabel = p.propertyTypes[0]
    ? p.propertyTypes[0].charAt(0).toUpperCase() + p.propertyTypes[0].slice(1)
    : null;

  return (
    <Link href={`/projects/${p.slug}`} style={{ textDecoration: "none", display: "block" }}>
      <article
        className="lr-card"
        style={{ background: "white", borderRadius: 18, overflow: "hidden", transition: "transform 0.25s, box-shadow 0.25s", cursor: "pointer" }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translateY(-5px)"; el.style.boxShadow = "0 20px 52px rgba(0,0,0,0.28)"; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translateY(0)"; el.style.boxShadow = "none"; }}
      >
        {/* Image */}
        <div style={{ position: "relative", aspectRatio: "16/10", overflow: "hidden" }}>
          <img src={p.image} alt={p.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.5s ease" }}
            onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.transform = "scale(1.06)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.transform = "scale(1)"; }}
          />
          {tag && p.tag && (
            <span style={{ position: "absolute", top: 12, left: 12, background: tag.bg, color: tag.color, fontFamily: "Verdana, sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 11px", borderRadius: 999 }}>
              {p.tag}
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px 20px" }}>
          <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "#192537", margin: "0 0 6px", lineHeight: 1.25 }}>
            {p.name}
          </h3>

          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}>
            <MapPin size={11} color="#7fe2e3" style={{ flexShrink: 0 }} />
            <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.area}
            </span>
          </div>

          {/* Tags row */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {p.bedrooms && (
              <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#555", background: "#f4f6f9", borderRadius: 999, padding: "3px 10px" }}>
                {p.bedrooms} BR
              </span>
            )}
            {typeLabel && (
              <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#555", background: "#f4f6f9", borderRadius: 999, padding: "3px 10px" }}>
                {typeLabel}
              </span>
            )}
          </div>

          {/* Price + arrow */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid #f0f0f0" }}>
            <div>
              {p.priceFrom > 0 ? (
                <>
                  <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "#bbb", marginBottom: 2, letterSpacing: "0.05em", textTransform: "uppercase" }}>from</div>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 17, color: "#192537" }}>{fmt(p.priceFrom)}</div>
                </>
              ) : (
                <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#bbb" }}>Price on request</div>
              )}
            </div>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#192537", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#7fe2e3"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#192537"; }}
            >
              <ArrowUpRight size={14} color="white" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function LuxuryResidences({ projects }: { projects: Project[] }) {
  const validProjects = projects.filter(p => p.image && !p.image.includes("unsplash"));

  const cats = ["All", ...TYPE_LABELS.filter(t =>
    validProjects.some(p => p.propertyTypes.some(pt => pt.toLowerCase() === t.toLowerCase()))
  )];

  const [activeCategory, setActiveCategory] = useState("All");
  const [fading, setFading] = useState(false);

  const displayed = (activeCategory === "All"
    ? validProjects
    : validProjects.filter(p => p.propertyTypes.some(pt => pt.toLowerCase() === activeCategory.toLowerCase()))
  ).slice(0, 9);

  function switchTab(cat: string) {
    if (cat === activeCategory) return;
    setFading(true);
    setTimeout(() => { setActiveCategory(cat); setFading(false); }, 220);
  }

  return (
    <section style={{ background: "#0d1e2e", padding: "80px 0 72px" }}>

      {/* ── Header ── */}
      <div style={{ textAlign: "center", padding: "0 24px", marginBottom: 36 }}>
        <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.3em", textTransform: "uppercase", margin: "0 0 12px" }}>
          Our Portfolio
        </p>
        <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(26px, 3.5vw, 46px)", color: "white", margin: 0, lineHeight: 1.08, letterSpacing: "-0.025em" }}>
          Luxury &{" "}<span style={{ color: "#7fe2e3" }}>Off-Plan Projects</span>
        </h2>
      </div>

      {/* ── Category tabs — centered ── */}
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, padding: "0 24px", marginBottom: 52 }}>
        {cats.map(cat => {
          const isActive = activeCategory === cat;
          return (
            <button key={cat} onClick={() => switchTab(cat)}
              style={{ padding: "9px 24px", borderRadius: 999, border: `1.5px solid ${isActive ? "#7fe2e3" : "rgba(255,255,255,0.14)"}`, background: isActive ? "#7fe2e3" : "transparent", color: isActive ? "#0d1e2e" : "rgba(255,255,255,0.55)", fontFamily: "Montserrat, sans-serif", fontWeight: isActive ? 700 : 400, fontSize: 13, cursor: "pointer", transition: "all 0.2s", letterSpacing: "0.02em" }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)"; e.currentTarget.style.color = "white"; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; } }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* ── Card grid ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <div
          className="lr-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, opacity: fading ? 0 : 1, transition: "opacity 0.22s ease" }}
        >
          {displayed.map(p => <ProjectCard key={p.id} p={p} />)}
        </div>

        {/* ── View All ── */}
        <div style={{ textAlign: "center", marginTop: 52 }}>
          <Link
            href={activeCategory === "All" ? "/projects" : `/projects?type=${encodeURIComponent(activeCategory)}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 34px", borderRadius: 999, border: "1.5px solid rgba(255,255,255,0.2)", color: "white", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, textDecoration: "none", transition: "all 0.2s", letterSpacing: "0.02em" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#7fe2e3"; e.currentTarget.style.color = "#7fe2e3"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "white"; }}
          >
            View All {activeCategory === "All" ? "" : activeCategory} Projects
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>

      <style>{`
        .lr-card { box-shadow: 0 4px 24px rgba(0,0,0,0.18); }
        @media (max-width: 1024px) { .lr-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 600px)  { .lr-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}
