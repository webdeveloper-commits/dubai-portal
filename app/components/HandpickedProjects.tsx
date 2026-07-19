import Link from "next/link";
import { MapPin, ArrowUpRight } from "lucide-react";
import type { Project } from "@/app/components/ProjectResults";

function fmt(n: number) {
  if (n >= 1_000_000) return "AED " + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000)     return "AED " + (n / 1_000).toFixed(0) + "K";
  return "AED " + n.toLocaleString();
}

const TAG_STYLE: Record<string, { bg: string; color: string }> = {
  "Off-Plan":   { bg: "#192537", color: "#7fe2e3" },
  "Ready":      { bg: "#0f7a7b", color: "white"  },
  "New Launch": { bg: "#f97316", color: "white"  },
};

function HandpickedCard({ p }: { p: Project }) {
  const tag = p.tag ? (TAG_STYLE[p.tag] ?? TAG_STYLE["Off-Plan"]) : null;

  return (
    <Link href={`/projects/${p.slug}`} className="hp-card-link" style={{ textDecoration: "none", display: "block" }}>
      <article className="hp-card" style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 16px rgba(25,37,55,0.07)", cursor: "pointer" }}>

        {/* Image */}
        <div style={{ position: "relative", aspectRatio: "16/10", overflow: "hidden" }}>
          <img
            src={p.image}
            alt={p.name}
            className="hp-card-img"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          {tag && p.tag && (
            <span style={{ position: "absolute", top: 12, left: 12, background: tag.bg, color: tag.color, fontFamily: "Verdana, sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 11px", borderRadius: 999 }}>
              {p.tag}
            </span>
          )}
          <span style={{ position: "absolute", top: 12, right: 12, background: "rgba(127,226,227,0.95)", color: "#192537", fontFamily: "Verdana, sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 999 }}>
            ★ Picked
          </span>
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid #f0f2f4" }}>
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
            <div className="hp-arrow" style={{ width: 36, height: 36, borderRadius: "50%", background: "#192537", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ArrowUpRight size={14} color="white" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function HandpickedProjects({ projects }: { projects: Project[] }) {
  if (!projects || projects.length === 0) return null;

  return (
    <section style={{ background: "#fff", padding: "80px 0 72px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>

        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 14 }}>
            Curated Selection
          </p>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 500, fontSize: "clamp(30px, 4.5vw, 52px)", color: "#192537", lineHeight: 1.1, margin: 0, letterSpacing: "-0.02em" }}>
            Our Curated Picks
          </h2>
        </div>

        {/* Grid */}
        <div className="hp-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {projects.slice(0, 6).map(p => <HandpickedCard key={p.id} p={p} />)}
        </div>
      </div>

      <style>{`
        .hp-card { transition: transform 0.25s, box-shadow 0.25s; }
        .hp-card-link:hover .hp-card { transform: translateY(-5px); box-shadow: 0 16px 48px rgba(25,37,55,0.16); }
        .hp-card-img { transition: transform 0.5s ease; }
        .hp-card-link:hover .hp-card-img { transform: scale(1.05); }
        .hp-card-link:hover .hp-arrow { background: #7fe2e3 !important; }
        @media (max-width: 1024px) { .hp-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 600px)  { .hp-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}
