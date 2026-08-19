"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, ArrowUpRight } from "lucide-react";
import Pagination from "@/app/components/Pagination";

const PAGE_SIZE = 15;

interface Developer {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  logo_url: string;
  founded_year: number;
  headquarters: string;
  total_units: string;
  areas: string[];
  property_types: string[];
  price_range: string;
}

function DevCard({ dev }: { dev: Developer }) {
  const initials = dev.name.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase();

  return (
    <Link href={`/developers/${dev.slug}`} style={{ textDecoration: "none", display: "block", height: "100%" }}>
      <article
        className="dev-card"
        style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 16px rgba(25,37,55,0.06)", border: "1px solid rgba(25,37,55,0.08)", height: "100%", display: "flex", flexDirection: "column", transition: "transform 0.25s, box-shadow 0.25s", cursor: "pointer" }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translateY(-4px)"; el.style.boxShadow = "0 16px 48px rgba(25,37,55,0.13)"; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translateY(0)"; el.style.boxShadow = "0 2px 16px rgba(25,37,55,0.06)"; }}
      >

        {/* ── HEADER — dark, logo only ── */}
        <div style={{ background: "linear-gradient(135deg, #0d1e2e 0%, #192537 100%)", height: 160, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 28px", position: "relative", overflow: "hidden", flexShrink: 0 }}>
          {/* subtle dot grid */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(127,226,227,0.06) 1px, transparent 1px)", backgroundSize: "26px 26px", pointerEvents: "none" }} />
          {dev.logo_url ? (
            <img src={dev.logo_url} alt={dev.name} style={{ maxHeight: 110, maxWidth: 220, objectFit: "contain", position: "relative", zIndex: 1 }} />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: 20, background: "rgba(127,226,227,0.12)", border: "1.5px solid rgba(127,226,227,0.25)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 26, color: "#7fe2e3", letterSpacing: "-0.02em" }}>{initials}</span>
            </div>
          )}
        </div>

        {/* ── BODY — all text details ── */}
        <div style={{ padding: "20px 22px 22px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Name + tagline */}
          <div>
            <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "#192537", margin: "0 0 5px", lineHeight: 1.25, letterSpacing: "-0.01em" }}>{dev.name}</h3>
            {dev.tagline && (
              <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e", margin: 0, lineHeight: 1.6 }}>{dev.tagline}</p>
            )}
          </div>

          {/* Stats row */}
          {(dev.founded_year || dev.total_units || dev.headquarters) && (
            <div style={{ display: "flex", gap: 0, borderRadius: 10, background: "#f8fafc", border: "1px solid #eef0f4", overflow: "hidden" }}>
              {dev.founded_year && (
                <div style={{ flex: 1, padding: "9px 12px", borderRight: "1px solid #eef0f4" }}>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#192537" }}>{dev.founded_year}</div>
                  <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "#aaa", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Est.</div>
                </div>
              )}
              {dev.total_units && (
                <div style={{ flex: 1, padding: "9px 12px", borderRight: dev.headquarters ? "1px solid #eef0f4" : undefined }}>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#192537" }}>{dev.total_units}</div>
                  <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "#aaa", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Units</div>
                </div>
              )}
              {dev.headquarters && (
                <div style={{ flex: 1, padding: "9px 12px" }}>
                  <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#192537", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dev.headquarters.split(",")[0]}</div>
                  <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "#aaa", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>HQ</div>
                </div>
              )}
            </div>
          )}

          {/* Area pills */}
          {dev.areas?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {dev.areas.slice(0, 3).map(a => (
                <span key={a} style={{ display: "inline-block", background: "rgba(127,226,227,0.08)", border: "1px solid rgba(127,226,227,0.22)", borderRadius: 999, padding: "4px 11px", fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#5a8a9e" }}>{a}</span>
              ))}
              {dev.areas.length > 3 && (
                <span style={{ display: "inline-block", background: "#f4f7fa", borderRadius: 999, padding: "4px 11px", fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#aaa" }}>+{dev.areas.length - 3} more</span>
              )}
            </div>
          )}

          {/* CTA */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 14, borderTop: "1px solid #f0f2f5" }}>
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12, color: "#7fe2e3", letterSpacing: "0.02em" }}>View Profile</span>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#192537", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} className="dev-arrow">
              <ArrowUpRight size={14} color="white" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function SearchableDevGrid({ devs }: { devs: Developer[] }) {
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);

  useEffect(() => { setPage(1); }, [search]);

  const filtered = devs.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      {/* Search bar */}
      <div style={{ maxWidth: 720, margin: "0 auto 48px", padding: "0 24px" }}>
        <div style={{ display: "flex", background: "white", borderRadius: 14, boxShadow: "0 2px 16px rgba(25,37,55,0.08)", border: "1px solid rgba(25,37,55,0.08)", overflow: "hidden" }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search developer name…"
            style={{ flex: 1, padding: "16px 20px", border: "none", outline: "none", fontFamily: "Verdana,sans-serif", fontSize: 13, color: "#333", background: "transparent" }}
          />
          <button style={{ display: "flex", alignItems: "center", gap: 8, background: "#7fe2e3", color: "#192537", fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 13, padding: "16px 28px", border: "none", cursor: "pointer", flexShrink: 0, letterSpacing: "0.02em" }}>
            <Search size={15} />
            Search
          </button>
        </div>
        {search && (
          <p style={{ fontFamily: "Verdana,sans-serif", fontSize: 12, color: "#aaa", marginTop: 10, paddingLeft: 4 }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
            {filtered.length > PAGE_SIZE && ` — page ${page} of ${Math.ceil(filtered.length / PAGE_SIZE)}`}
          </p>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 20, color: "#192537", marginBottom: 10 }}>No developers found</p>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e" }}>Try a different search term.</p>
        </div>
      ) : (
        <>
          <div className="dev-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 28 }}>
            {paginated.map(d => <DevCard key={d.id} dev={d} />)}
          </div>
          <Pagination
            page={page}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            onChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          />
        </>
      )}

      <style>{`
        @media (max-width: 1024px) { .dev-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 640px)  { .dev-grid { grid-template-columns: 1fr !important; } }
        .dev-card:hover .dev-arrow { background: #7fe2e3 !important; }
      `}</style>
    </>
  );
}
