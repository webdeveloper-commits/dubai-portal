"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, ArrowUpRight, Building2 } from "lucide-react";

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
  return (
    <Link href={`/developers/${dev.slug}`} style={{ textDecoration: "none", display: "block", height: "100%" }}>
      <article
        style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 16px rgba(25,37,55,0.06)", border: "1px solid rgba(25,37,55,0.06)", height: "100%", display: "flex", flexDirection: "column", transition: "transform 0.25s, box-shadow 0.25s", cursor: "pointer" }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translateY(-4px)"; el.style.boxShadow = "0 14px 40px rgba(25,37,55,0.12)"; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translateY(0)"; el.style.boxShadow = "0 2px 16px rgba(25,37,55,0.06)"; }}
      >
        <div style={{ background: "linear-gradient(135deg, #0d1e2e 0%, #192537 100%)", padding: "32px 28px 28px", position: "relative", overflow: "hidden", minHeight: 120, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(127,226,227,0.07) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            {dev.logo_url
              ? <img src={dev.logo_url} alt={dev.name} style={{ height: 48, maxWidth: 160, objectFit: "contain", opacity: 0.95 }} />
              : <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: 20, color: "white", letterSpacing: "-0.02em" }}>{dev.name}</div>
            }
            {dev.tagline && <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(127,226,227,0.7)", marginTop: 8 }}>{dev.tagline}</div>}
          </div>
          <Building2 size={32} color="rgba(127,226,227,0.12)" style={{ flexShrink: 0 }} />
        </div>

        <div style={{ padding: "22px 24px 24px", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 20 }}>
            {dev.founded_year && (
              <div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "#192537" }}>{dev.founded_year}</div>
                <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#aaa", marginTop: 2 }}>Est.</div>
              </div>
            )}
            {dev.total_units && (
              <div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "#192537" }}>{dev.total_units}</div>
                <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#aaa", marginTop: 2 }}>Units Delivered</div>
              </div>
            )}
            {dev.headquarters && (
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e" }}>{dev.headquarters.split(",")[0]}</div>
                <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#aaa", marginTop: 2 }}>HQ</div>
              </div>
            )}
          </div>

          {dev.areas?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {dev.areas.slice(0, 3).map(a => (
                <span key={a} style={{ display: "inline-block", background: "rgba(127,226,227,0.08)", border: "1px solid rgba(127,226,227,0.2)", borderRadius: 999, padding: "3px 10px", fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7a8a9e" }}>{a}</span>
              ))}
              {dev.areas.length > 3 && (
                <span style={{ display: "inline-block", background: "#f4f7fa", borderRadius: 999, padding: "3px 10px", fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#aaa" }}>+{dev.areas.length - 3} more</span>
              )}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 14, borderTop: "1px solid #f0f0f0" }}>
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12, color: "#7fe2e3" }}>View Profile</span>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#192537", display: "flex", alignItems: "center", justifyContent: "center" }}>
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

  const filtered = devs.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

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
        <div className="dev-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 28 }}>
          {filtered.map(d => <DevCard key={d.id} dev={d} />)}
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) { .dev-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 640px)  { .dev-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  );
}
