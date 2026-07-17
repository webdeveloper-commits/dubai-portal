"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { X, MapPin, ArrowUpRight } from "lucide-react";
import EnquiryModal from "@/app/components/EnquiryModal";

interface FeaturedProject {
  name:       string;
  slug:       string;
  price_from: number | null;
  image_main: string | null;
  area:       string;
  developer:  string;
}

function fmt(n: number) {
  if (n >= 1_000_000) return "AED " + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  return "AED " + n.toLocaleString();
}

export default function FeaturedProjectPopup({ project }: { project: FeaturedProject | null }) {
  const [visible,  setVisible]  = useState(false);
  const [enquiry,  setEnquiry]  = useState(false);

  useEffect(() => {
    if (!project) return;
    const key = `fp_popup_${project.slug}`;
    if (sessionStorage.getItem(key)) return;
    const timer = setTimeout(() => {
      setVisible(true);
      sessionStorage.setItem(key, "1");
    }, 5000);
    return () => clearTimeout(timer);
  }, [project]);

  if (!project) return null;
  if (!visible)  return null;

  return (
    <>
      {/* Overlay */}
      <div onClick={() => setVisible(false)} style={{
        position: "fixed", inset: 0, zIndex: 9900,
        background: "rgba(10,18,28,0.72)", backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        animation: "fpFadeIn 0.4s ease",
      }} />

      {/* Modal */}
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 9901,
        width: "min(92vw, 820px)",
        background: "white",
        borderRadius: 28,
        overflow: "hidden",
        boxShadow: "0 40px 100px rgba(10,18,28,0.45), 0 0 0 1px rgba(127,226,227,0.15)",
        animation: "fpPopUp 0.4s cubic-bezier(0.34,1.4,0.64,1)",
        display: "flex",
        flexDirection: "column" as const,
      }}>

        {/* ── Top image bar ── */}
        <div style={{ position: "relative", width: "100%", aspectRatio: "21/9", flexShrink: 0, overflow: "hidden" }}>
          {project.image_main
            ? <img src={project.image_main} alt={project.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <div style={{ width: "100%", height: "100%", background: "linear-gradient(145deg,#0d1e2e,#192537)" }} />
          }

          {/* Gradient overlay */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,18,28,0.65) 0%, rgba(10,18,28,0.1) 60%, transparent 100%)" }} />

          {/* Badge */}
          <div style={{
            position: "absolute", top: 18, left: 20, zIndex: 2,
            background: "#7fe2e3", color: "#192537",
            fontFamily: "Montserrat, sans-serif", fontWeight: 800,
            fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
            padding: "7px 16px", borderRadius: 999,
            boxShadow: "0 4px 16px rgba(127,226,227,0.4)",
          }}>
            Featured Project
          </div>

          {/* Close */}
          <button onClick={() => setVisible(false)} style={{
            position: "absolute", top: 16, right: 16, zIndex: 2,
            width: 38, height: 38, borderRadius: "50%",
            background: "rgba(10,18,28,0.6)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s",
          }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(10,18,28,0.85)"}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(10,18,28,0.6)"}
          >
            <X size={16} color="white" />
          </button>

          {/* Project name over image */}
          <div style={{ position: "absolute", bottom: 20, left: 24, right: 24, zIndex: 2 }}>
            <h2 style={{
              fontFamily: "Montserrat, sans-serif", fontWeight: 800,
              fontSize: "clamp(22px,3.5vw,34px)",
              color: "white", margin: 0, lineHeight: 1.15,
              textShadow: "0 2px 12px rgba(0,0,0,0.4)",
            }}>
              {project.name}
            </h2>
          </div>
        </div>

        {/* ── Bottom content ── */}
        <div style={{ padding: "24px 28px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" as const }}>

          {/* Left: meta */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" as const }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <MapPin size={12} color="#7fe2e3" />
                <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#7a8a9e" }}>{project.area}</span>
              </div>
              {project.developer && (
                <>
                  <span style={{ color: "#e0e0e0", fontSize: 12 }}>·</span>
                  <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#7a8a9e" }}>{project.developer}</span>
                </>
              )}
            </div>

            {project.price_from && project.price_from > 0 && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, color: "#192537", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {fmt(project.price_from)}
                </span>
                <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#bbb" }}>starting from</span>
              </div>
            )}
          </div>

          {/* Right: CTAs */}
          <div style={{ display: "flex", gap: 10, flexShrink: 0, flexWrap: "wrap" as const }}>
            <button
              onClick={() => { setEnquiry(true); }}
              style={{
                padding: "13px 22px", borderRadius: 14,
                border: "2px solid #192537", background: "transparent",
                fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13,
                color: "#192537", cursor: "pointer", whiteSpace: "nowrap" as const,
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#192537"; (e.currentTarget as HTMLButtonElement).style.color = "white"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#192537"; }}
            >
              Enquire Now
            </button>

            <Link
              href={`/projects/${project.slug}`}
              onClick={() => setVisible(false)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "13px 24px", borderRadius: 14,
                background: "#192537", color: "white",
                fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13,
                textDecoration: "none", whiteSpace: "nowrap" as const,
                boxShadow: "0 6px 24px rgba(25,37,55,0.25)",
                transition: "background 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = "#7fe2e3"}
              onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = "#192537"}
            >
              Discover Project <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {enquiry && (
        <EnquiryModal
          isOpen={enquiry}
          onClose={() => setEnquiry(false)}
          context={{ projectName: project.name, areaName: project.area, developerName: project.developer }}
        />
      )}

      <style>{`
        @keyframes fpFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fpPopUp  {
          from { opacity: 0; transform: translate(-50%,-50%) scale(0.92) }
          to   { opacity: 1; transform: translate(-50%,-50%) scale(1) }
        }
        @media (max-width: 540px) {
          .fp-btns { flex-direction: column !important; }
        }
      `}</style>
    </>
  );
}
