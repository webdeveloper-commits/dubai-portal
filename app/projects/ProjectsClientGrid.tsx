"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import FilterBar, { FilterState } from "@/app/components/filter";
import { MapPin, Bed, Calendar, ArrowUpRight, SlidersHorizontal, ChevronDown } from "lucide-react";

interface Project {
  id: string;
  name: string;
  developer: string;
  area: string;
  propertyTypes: string[];
  priceFrom: number;
  handover: string;
  handoverYear: number;
  bedrooms: string;
  image: string;
  tag?: string;
  slug: string;
  lifestyle: string[];
}

type SortKey = "default" | "price_asc" | "price_desc" | "handover_asc";

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  "Off-Plan":   { bg: "#192537", color: "#7fe2e3" },
  "Ready":      { bg: "#7fe2e3", color: "#192537" },
  "New Launch": { bg: "#f97316", color: "white"   },
};

const pill: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  background: "#f4f7fa", borderRadius: 999, padding: "4px 10px",
  fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#555",
};

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "default",      label: "Default order" },
  { key: "price_asc",    label: "Price: Low → High" },
  { key: "price_desc",   label: "Price: High → Low" },
  { key: "handover_asc", label: "Earliest Handover" },
];

function fmt(n: number) {
  if (n >= 1_000_000) return "AED " + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000)     return "AED " + (n / 1_000).toFixed(0) + "K";
  return "AED " + n;
}

function applyFilters(projects: Project[], f: FilterState): Project[] {
  return projects.filter(p => {
    if (f.projectSearch && !p.name.toLowerCase().includes(f.projectSearch.toLowerCase())) return false;
    if (f.areas.length         && !f.areas.some(a => p.area.toLowerCase().includes(a.toLowerCase())))             return false;
    if (f.developers.length    && !f.developers.some(d => p.developer.toLowerCase().includes(d.toLowerCase())))   return false;
    if (f.propertyTypes.length && !f.propertyTypes.some(t => p.propertyTypes.map(x => x.toLowerCase()).includes(t.toLowerCase()))) return false;
    if (f.lifestyle.length     && !f.lifestyle.some(l => p.lifestyle.some(x => x.toLowerCase().includes(l.toLowerCase())))) return false;
    if (f.handover.length) {
      const ok = f.handover.some(h => h === "Ready Now" ? p.tag === "Ready" : p.handoverYear === parseInt(h));
      if (!ok) return false;
    }
    if (f.priceFrom > 0 && p.priceFrom < f.priceFrom) return false;
    if (f.priceTo   < 100_000_000 && p.priceFrom > f.priceTo) return false;
    return true;
  });
}

function sortProjects(projects: Project[], key: SortKey): Project[] {
  const arr = [...projects];
  if (key === "price_asc")    return arr.sort((a, b) => a.priceFrom - b.priceFrom);
  if (key === "price_desc")   return arr.sort((a, b) => b.priceFrom - a.priceFrom);
  if (key === "handover_asc") return arr.sort((a, b) => a.handoverYear - b.handoverYear);
  return arr;
}

function ProjectCard({ p }: { p: Project }) {
  const tag = p.tag ? (TAG_COLORS[p.tag] ?? TAG_COLORS["Off-Plan"]) : null;
  return (
    <Link href={`/projects/${p.slug}`} style={{ textDecoration: "none", display: "block", height: "100%" }}>
      <article
        style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 20px rgba(25,37,55,0.06)", border: "1px solid rgba(25,37,55,0.06)", transition: "transform 0.25s, box-shadow 0.25s", cursor: "pointer", height: "100%", display: "flex", flexDirection: "column" }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translateY(-4px)"; el.style.boxShadow = "0 14px 44px rgba(25,37,55,0.13)"; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translateY(0)";    el.style.boxShadow = "0 2px 20px rgba(25,37,55,0.06)"; }}
      >
        <div style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", flexShrink: 0 }}>
          <img src={p.image} alt={p.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.45s ease" }}
            onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.transform = "scale(1.05)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.transform = "scale(1)"; }}
          />
          {tag && p.tag && (
            <span style={{ position: "absolute", top: 14, left: 14, background: tag.bg, color: tag.color, fontFamily: "Verdana, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "5px 13px", borderRadius: 999 }}>
              {p.tag}
            </span>
          )}
        </div>
        <div style={{ padding: "20px 22px 22px", display: "flex", flexDirection: "column", flex: 1 }}>
          <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "#192537", margin: "0 0 4px", lineHeight: 1.25 }}>{p.name}</h3>
          {p.developer && <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e", margin: "0 0 14px" }}>by {p.developer}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {p.area     && <span style={pill}><MapPin   size={9} color="#7fe2e3" />{p.area}</span>}
            {p.bedrooms && <span style={pill}><Bed      size={9} color="#7fe2e3" />{p.bedrooms}</span>}
            {p.handover && <span style={pill}><Calendar size={9} color="#7fe2e3" />{p.handover}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 16, borderTop: "1px solid #f0f0f0" }}>
            <div>
              {p.priceFrom > 0 && <>
                <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#bbb", marginBottom: 2 }}>from</div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 18, color: "#192537" }}>{fmt(p.priceFrom)}</div>
              </>}
            </div>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#192537", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ArrowUpRight size={15} color="white" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

function SortDropdown({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const label = SORT_OPTIONS.find(o => o.key === value)?.label ?? "Sort";
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 16px", borderRadius: 10, border: "1.5px solid #e0e0e0", background: "white", fontFamily: "Verdana", fontSize: 12, color: "#555", cursor: "pointer", whiteSpace: "nowrap" }}>
        <SlidersHorizontal size={13} color="#7fe2e3" />
        {label}
        <ChevronDown size={12} color="#aaa" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: 48, right: 0, background: "white", border: "1.5px solid #e5e5e5", borderRadius: 12, zIndex: 200, boxShadow: "0 8px 28px rgba(0,0,0,0.1)", overflow: "hidden", minWidth: 190 }}>
          {SORT_OPTIONS.map(o => (
            <button key={o.key} onClick={() => { onChange(o.key); setOpen(false); }} style={{ display: "block", width: "100%", padding: "12px 16px", textAlign: "left", fontFamily: "Verdana", fontSize: 12, color: o.key === value ? "#7fe2e3" : "#333", background: o.key === value ? "#f0fbfb" : "white", border: "none", cursor: "pointer", borderBottom: "0.5px solid #f5f5f5" }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectsClientGrid({ projects }: { projects: Project[] }) {
  const [filters, setFilters] = useState<FilterState | null>(null);
  const [sort, setSort]       = useState<SortKey>("default");

  const displayed = useMemo(() => {
    const base = filters ? applyFilters(projects, filters) : projects;
    return sortProjects(base, sort);
  }, [projects, filters, sort]);

  const activeFilterCount = filters
    ? [filters.areas, filters.developers, filters.propertyTypes, filters.lifestyle, filters.handover]
        .reduce((n, arr) => n + arr.length, 0)
      + (filters.priceFrom > 0 || filters.priceTo < 100_000_000 ? 1 : 0)
      + (filters.projectSearch ? 1 : 0)
    : 0;

  return (
    <>
      {/* Filter bar — inside dark hero-coloured band */}
      <div style={{ background: "#0d1e2e", padding: "0 24px 48px", marginTop: -1 }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <FilterBar onSearch={setFilters} />
        </div>
      </div>

      {/* Grid section */}
      <section style={{ background: "#f9f9f9", padding: "56px 24px 96px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>

          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36, flexWrap: "wrap", gap: 12 }}>
            <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", margin: 0 }}>
              Showing <strong style={{ fontFamily: "Montserrat, sans-serif", color: "#192537" }}>{displayed.length}</strong> project{displayed.length !== 1 ? "s" : ""}
              {activeFilterCount > 0 && (
                <span style={{ marginLeft: 10, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(127,226,227,0.12)", color: "#192537", fontFamily: "Verdana", fontSize: 11, padding: "3px 10px", borderRadius: 999 }}>
                  {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active
                  <button onClick={() => setFilters(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#7a8a9e", fontSize: 14, marginLeft: 2 }}>×</button>
                </span>
              )}
            </p>
            <SortDropdown value={sort} onChange={setSort} />
          </div>

          {/* Cards */}
          {displayed.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 22, color: "#192537", marginBottom: 10 }}>No projects found</p>
              <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", marginBottom: 24 }}>Try adjusting your filters.</p>
              <button onClick={() => setFilters(null)} style={{ background: "#192537", color: "white", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, padding: "12px 28px", borderRadius: 999, border: "none", cursor: "pointer" }}>
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="proj-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
              {displayed.map(p => <ProjectCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </section>

      <style>{`
        @media (max-width: 1024px) { .proj-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 640px)  { .proj-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  );
}
