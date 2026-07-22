"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, ArrowUpRight } from "lucide-react";
import Pagination from "@/app/components/Pagination";

const PAGE_SIZE = 15;

interface AreaSummary {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  hero_image: string | null;
  roi_pct: number | null;
  best_for: string | null;
}

function AreaCard({ area }: { area: AreaSummary }) {
  const hasImage = Boolean(area.hero_image);
  return (
    <Link href={`/area-guides/${area.slug}`} style={{ textDecoration: "none", display: "block", height: "100%" }}>
      <article className="area-card" style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 20px rgba(25,37,55,0.06)", border: "1px solid rgba(25,37,55,0.06)", cursor: "pointer", height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden", flexShrink: 0, background: hasImage ? undefined : "linear-gradient(135deg,#192537 0%,#0d3d5a 50%,#1a4a60 100%)" }}>
          {hasImage
            ? <img src={area.hero_image!} alt={area.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.45s ease" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 800, fontSize: 28, color: "rgba(127,226,227,0.25)", letterSpacing: "-0.03em", textTransform: "uppercase" }}>{area.name}</span>
              </div>
          }
          {area.roi_pct != null && (
            <span style={{ position: "absolute", top: 14, right: 14, background: "rgba(25,37,55,0.82)", backdropFilter: "blur(8px)", color: "#7fe2e3", fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 11, padding: "5px 12px", borderRadius: 999, border: "1px solid rgba(127,226,227,0.25)" }}>
              {area.roi_pct}% ROI
            </span>
          )}
        </div>
        <div style={{ padding: "20px 22px 22px", display: "flex", flexDirection: "column", flex: 1 }}>
          <h3 style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 18, color: "#192537", margin: "0 0 6px", lineHeight: 1.2 }}>{area.name}</h3>
          {area.tagline && <p style={{ fontFamily: "Verdana,sans-serif", fontSize: 12, color: "#7a8a9e", margin: "0 0 14px", lineHeight: 1.6 }}>{area.tagline}</p>}
          {area.best_for && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ display: "inline-block", background: "rgba(127,226,227,0.1)", color: "#0d5e5f", fontFamily: "Verdana,sans-serif", fontSize: 10, padding: "4px 12px", borderRadius: 999, border: "1px solid rgba(127,226,227,0.2)" }}>
                Best for: {area.best_for}
              </span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 16, borderTop: "1px solid #f0f0f0" }}>
            <span style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 13, color: "#7fe2e3" }}>Explore →</span>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#192537", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ArrowUpRight size={14} color="white" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function SearchableAreaGrid({ areas }: { areas: AreaSummary[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage]   = useState(1);

  useEffect(() => { setPage(1); }, [query]);

  const filtered = areas.filter(a =>
    a.name.toLowerCase().includes(query.toLowerCase()) ||
    (a.tagline ?? "").toLowerCase().includes(query.toLowerCase()) ||
    (a.best_for ?? "").toLowerCase().includes(query.toLowerCase())
  );

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      {/* Search bar */}
      <div style={{ maxWidth: 720, margin: "0 auto 48px", padding: "0 24px" }}>
        <div style={{ display: "flex", gap: 0, background: "white", borderRadius: 14, boxShadow: "0 2px 16px rgba(25,37,55,0.08)", border: "1px solid rgba(25,37,55,0.08)", overflow: "hidden" }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search area name…"
            style={{ flex: 1, padding: "16px 20px", border: "none", outline: "none", fontFamily: "Verdana,sans-serif", fontSize: 13, color: "#333", background: "transparent" }}
          />
          <button
            onClick={() => {/* filtering is live */}}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "#7fe2e3", color: "#192537", fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 13, padding: "16px 28px", border: "none", cursor: "pointer", flexShrink: 0, letterSpacing: "0.02em" }}
          >
            <Search size={15} />
            Search
          </button>
        </div>
        {query && (
          <p style={{ fontFamily: "Verdana,sans-serif", fontSize: 12, color: "#aaa", marginTop: 10, paddingLeft: 4 }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
            {filtered.length > PAGE_SIZE && ` — page ${page} of ${Math.ceil(filtered.length / PAGE_SIZE)}`}
          </p>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 20, color: "#192537", marginBottom: 10 }}>No areas found</p>
          <p style={{ fontFamily: "Verdana,sans-serif", fontSize: 13, color: "#7a8a9e" }}>Try a different search term.</p>
        </div>
      ) : (
        <>
          <div className="areas-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 28 }}>
            {paginated.map(area => <AreaCard key={area.id} area={area} />)}
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
        .area-card { transition: transform 0.25s, box-shadow 0.25s; }
        .area-card:hover { transform: translateY(-4px); box-shadow: 0 14px 44px rgba(25,37,55,0.13) !important; }
        @media (max-width: 1024px) { .areas-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 640px)  { .areas-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  );
}
