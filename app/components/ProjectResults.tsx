"use client";
import { useState } from "react";
import { MapPin, Bed, Calendar, ArrowUpRight, Building2 } from "lucide-react";
import { FilterState } from "@/app/components/filter";

export interface Project {
  id: string;
  name: string;
  developer: string;
  area: string;
  propertyTypes: string[];
  priceFrom: number;
  priceTo?: number;
  handover: string;
  handoverYear?: number;
  bedrooms: string;
  image: string;
  tag?: string;
  slug: string;
  lifestyle?: string[];
}

interface ProjectResultsProps {
  projects: Project[];
  filters?: FilterState;
  loading?: boolean;
}

const PAGE_SIZE = 9;

const TAG_BG: Record<string, string> = {
  "Off-Plan":   "#0d1e2e",
  "New Launch": "#f97316",
  "Ready":      "#0f7a7b",
};

function fmt(n: number) {
  if (n >= 1_000_000) return "AED " + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000)     return "AED " + Math.round(n / 1_000) + "K";
  return "AED " + n.toLocaleString();
}

function ProjectCard({ project }: { project: Project }) {
  const tagBg = project.tag ? (TAG_BG[project.tag] ?? "#0d1e2e") : null;

  return (
    <a href={`/projects/${project.slug}`} className="proj-card" style={{ textDecoration: "none", display: "flex", flexDirection: "column", background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 20px rgba(25,37,55,0.07)", border: "1px solid rgba(25,37,55,0.06)", transition: "transform 0.25s, box-shadow 0.25s" }}>

      {/* Image */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", overflow: "hidden", flexShrink: 0 }}>
        {project.image
          ? <img src={project.image} alt={project.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.45s ease" }} className="proj-img" />
          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#0d1e2e,#192537)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 800, fontSize: 22, color: "rgba(127,226,227,0.18)", letterSpacing: "-0.02em" }}>{project.name}</span>
            </div>
        }
        {tagBg && project.tag && (
          <span style={{ position: "absolute", top: 14, left: 14, background: tagBg, color: "white", fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: "5px 12px", borderRadius: 999 }}>
            {project.tag}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", flex: 1 }}>

        {/* Name + developer */}
        <h3 style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 17, color: "#192537", margin: "0 0 4px", lineHeight: 1.2 }}>
          {project.name}
        </h3>
        <p style={{ fontFamily: "Verdana,sans-serif", fontSize: 11, color: "#7fe2e3", margin: "0 0 14px" }}>
          by {project.developer}
        </p>

        {/* Chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          <span className="chip"><MapPin size={10} style={{ color: "#7fe2e3", flexShrink: 0 }} />{project.area}</span>
          <span className="chip"><Bed size={10} style={{ color: "#7fe2e3", flexShrink: 0 }} />{project.bedrooms}</span>
          {project.handover && <span className="chip"><Calendar size={10} style={{ color: "#7fe2e3", flexShrink: 0 }} />{project.handover}</span>}
        </div>

        {/* Property types */}
        {project.propertyTypes.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 16 }}>
            <Building2 size={10} style={{ color: "#7fe2e3", flexShrink: 0 }} />
            <span style={{ fontFamily: "Verdana,sans-serif", fontSize: 10, color: "#7a8a9e" }}>{project.propertyTypes.join(", ")}</span>
          </div>
        )}

        {/* Price + arrow */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "auto", paddingTop: 14, borderTop: "1px solid #f0f0f0" }}>
          <div>
            <div style={{ fontFamily: "Verdana,sans-serif", fontSize: 10, color: "#aaa", marginBottom: 2 }}>from</div>
            <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 800, fontSize: 20, color: "#192537", letterSpacing: "-0.02em" }}>
              {project.priceFrom > 0 ? fmt(project.priceFrom) : "On Request"}
            </div>
          </div>
          <div className="proj-arrow" style={{ width: 42, height: 42, borderRadius: "50%", background: "#192537", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s" }}>
            <ArrowUpRight size={18} color="white" />
          </div>
        </div>

      </div>
    </a>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 20px rgba(25,37,55,0.07)", border: "1px solid rgba(25,37,55,0.06)" }}>
      <div style={{ width: "100%", aspectRatio: "4/3", background: "#f0f0f0" }} />
      <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ height: 18, width: "65%", background: "#f0f0f0", borderRadius: 6 }} />
        <div style={{ height: 12, width: "40%", background: "#f0f0f0", borderRadius: 6 }} />
        <div style={{ height: 12, width: "90%", background: "#f0f0f0", borderRadius: 6 }} />
        <div style={{ height: 28, width: "50%", background: "#f0f0f0", borderRadius: 6, marginTop: 8 }} />
      </div>
    </div>
  );
}

export default function ProjectResults({ projects, loading = false }: ProjectResultsProps) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = projects.slice(0, visible);
  const hasMore = visible < projects.length;

  if (!loading && projects.length === 0) {
    return (
      <section style={{ background: "#f9f9f9", padding: "80px 32px", textAlign: "center" }}>
        <p style={{ fontFamily: "Montserrat,sans-serif", fontSize: 22, fontWeight: 700, color: "#192537", marginBottom: 8 }}>No projects found</p>
        <p style={{ fontFamily: "Verdana,sans-serif", fontSize: 13, color: "#aaa" }}>Try adjusting your filters to see more results.</p>
      </section>
    );
  }

  return (
    <>
      <style>{`
        .proj-card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(25,37,55,0.13) !important; }
        .proj-card:hover .proj-img { transform: scale(1.04); }
        .proj-card:hover .proj-arrow { background: #7fe2e3 !important; }
        .chip {
          display: inline-flex; align-items: center; gap: 5px;
          background: #f4f7fa; border-radius: 999px; padding: 5px 10px;
          font-family: Verdana,sans-serif; font-size: 10px; color: #555;
        }
        .pr-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        @media (max-width: 1024px) { .pr-grid { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 640px)  { .pr-grid { grid-template-columns: 1fr; } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .proj-card { animation: fadeUp 0.3s ease both; }
      `}</style>

      <section style={{ background: "#f9f9f9", padding: "72px 0 88px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", boxSizing: "border-box" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#7fe2e3" }} />
              <span style={{ fontFamily: "Verdana,sans-serif", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.3em", textTransform: "uppercase" }}>Search Results</span>
            </div>
            <h2 style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 500, fontSize: "clamp(24px,4vw,38px)", color: "#192537", margin: "0 0 8px", lineHeight: 1.15 }}>
              What You Are <span style={{ color: "#7fe2e3" }}>Looking For</span>
            </h2>
            <p style={{ fontFamily: "Verdana,sans-serif", fontSize: 12, color: "#aaa" }}>
              {loading ? "Searching…" : `${projects.length} project${projects.length !== 1 ? "s" : ""} found`}
            </p>
          </div>

          {/* Grid */}
          <div className="pr-grid">
            {loading
              ? Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonCard key={i} />)
              : shown.map((p, i) => (
                  <div key={p.id} style={{ animationDelay: `${(i % PAGE_SIZE) * 0.05}s` }}>
                    <ProjectCard project={p} />
                  </div>
                ))
            }
          </div>

          {/* Load more */}
          {!loading && hasMore && (
            <div style={{ textAlign: "center", marginTop: 52 }}>
              <p style={{ fontFamily: "Verdana,sans-serif", fontSize: 12, color: "#aaa", marginBottom: 16 }}>
                Showing {shown.length} of {projects.length} projects
              </p>
              <button
                onClick={() => setVisible(v => v + PAGE_SIZE)}
                style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#192537", color: "white", fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 13, padding: "14px 36px", borderRadius: 999, border: "none", cursor: "pointer", transition: "background 0.2s, color 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#7fe2e3"; e.currentTarget.style.color = "#192537"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#192537"; e.currentTarget.style.color = "white"; }}
              >
                Load More
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                  +{Math.min(PAGE_SIZE, projects.length - visible)}
                </span>
              </button>
            </div>
          )}

          {/* All loaded */}
          {!loading && !hasMore && projects.length > PAGE_SIZE && (
            <p style={{ textAlign: "center", fontFamily: "Verdana,sans-serif", fontSize: 12, color: "#ccc", marginTop: 40 }}>
              All {projects.length} projects shown
            </p>
          )}

        </div>
      </section>
    </>
  );
}
