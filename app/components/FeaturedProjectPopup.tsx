"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { X, MapPin, ArrowUpRight } from "lucide-react";

interface FeaturedProject {
  name:       string;
  slug:       string;
  price_from: number | null;
  image_main: string | null;
  area:       string;
  developer:  string;
  tag?:       string;
}

function fmt(n: number) {
  if (n >= 1_000_000) return "AED " + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  return "AED " + n.toLocaleString();
}

export default function FeaturedProjectPopup({ project }: { project: FeaturedProject | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!project) return;
    // Only show once per session
    const key = `fp_popup_${project.slug}`;
    if (sessionStorage.getItem(key)) return;

    const timer = setTimeout(() => {
      setVisible(true);
      sessionStorage.setItem(key, "1");
    }, 6000);
    return () => clearTimeout(timer);
  }, [project]);

  if (!visible || !project) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={() => setVisible(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 9900,
          background: "rgba(13,26,39,0.55)", backdropFilter: "blur(3px)",
          animation: "fadeIn 0.3s ease",
        }}
      />

      {/* Card */}
      <div style={{
        position: "fixed", bottom: 24, left: "50%", zIndex: 9901,
        transform: "translateX(-50%)",
        width: "min(92vw, 460px)",
        background: "white", borderRadius: 20,
        boxShadow: "0 28px 72px rgba(13,26,39,0.32)",
        overflow: "hidden",
        animation: "popUp 0.35s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        {/* Close */}
        <button
          onClick={() => setVisible(false)}
          style={{
            position: "absolute", top: 12, right: 12, zIndex: 2,
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(13,26,39,0.55)", backdropFilter: "blur(6px)",
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <X size={14} color="white" />
        </button>

        {/* Featured badge */}
        <div style={{
          position: "absolute", top: 12, left: 12, zIndex: 2,
          background: "#7fe2e3", color: "#192537",
          fontFamily: "Verdana, sans-serif", fontSize: 9, fontWeight: 700,
          letterSpacing: "0.18em", textTransform: "uppercase",
          padding: "5px 12px", borderRadius: 999,
        }}>
          Featured Project
        </div>

        {/* Image */}
        <div style={{ position: "relative", aspectRatio: "16/7", overflow: "hidden" }}>
          {project.image_main
            ? <img src={project.image_main} alt={project.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <div style={{ width: "100%", height: "100%", background: "linear-gradient(145deg,#0d1e2e,#192537)" }} />
          }
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(13,26,39,0.6) 0%, transparent 50%)" }} />
        </div>

        {/* Content */}
        <div style={{ padding: "18px 20px 20px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{
                fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 17,
                color: "#192537", margin: "0 0 4px", lineHeight: 1.2,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {project.name}
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                <MapPin size={10} color="#7fe2e3" />
                <span style={{ fontFamily: "Verdana", fontSize: 11, color: "#7a8a9e" }}>
                  {project.area}
                </span>
                {project.developer && (
                  <>
                    <span style={{ color: "#ddd" }}>·</span>
                    <span style={{ fontFamily: "Verdana", fontSize: 11, color: "#7a8a9e" }}>
                      {project.developer}
                    </span>
                  </>
                )}
              </div>
              {project.price_from && project.price_from > 0 && (
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 16, color: "#192537", letterSpacing: "-0.02em" }}>
                  {fmt(project.price_from)}
                  <span style={{ fontFamily: "Verdana", fontSize: 10, fontWeight: 400, color: "#aaa", marginLeft: 5 }}>starting from</span>
                </div>
              )}
            </div>

            <Link
              href={`/projects/${project.slug}`}
              onClick={() => setVisible(false)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                background: "#192537", color: "white",
                fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12,
                padding: "11px 16px", borderRadius: 12, textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Discover <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popUp  { from { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.96) }
                            to   { opacity: 1; transform: translateX(-50%) translateY(0)    scale(1)    } }
      `}</style>
    </>
  );
}
