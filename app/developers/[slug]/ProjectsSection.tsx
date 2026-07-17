"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface Project {
  name: string;
  slug: string;
  image_main?: string;
  status?: string;
  price_from?: number;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "Off-Plan":  { bg: "rgba(127,226,227,0.12)", text: "#0f7a7b" },
  "Ongoing":   { bg: "rgba(251,191,36,0.12)",  text: "#b45309" },
  "Completed": { bg: "rgba(34,197,94,0.1)",     text: "#16a34a" },
};

export default function ProjectsSection({
  projects,
  devName,
}: {
  projects: Project[];
  devName: string;
}) {
  const statuses = ["All", ...Array.from(new Set(projects.map(p => p.status || "Off-Plan")))];
  const [active, setActive] = useState("All");

  const filtered = active === "All" ? projects : projects.filter(p => (p.status || "Off-Plan") === active);

  if (!projects.length) return null;

  return (
    <div
      style={{
        background: "white",
        borderRadius: 20,
        padding: "36px",
        boxShadow: "0 2px 16px rgba(25,37,55,0.05)",
        border: "1px solid rgba(25,37,55,0.05)",
      }}
    >
      {/* Header + filter row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-montserrat), Montserrat, sans-serif",
            fontWeight: 700,
            fontSize: 20,
            color: "#192537",
            display: "flex",
            alignItems: "center",
            gap: 12,
            margin: 0,
          }}
        >
          <span
            style={{
              width: 4,
              height: 20,
              background: "#7fe2e3",
              borderRadius: 2,
              flexShrink: 0,
              display: "inline-block",
            }}
          />
          Projects on Elysian
        </h2>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setActive(s)}
              style={{
                border: "none",
                cursor: "pointer",
                borderRadius: 999,
                padding: "5px 14px",
                fontFamily: "Verdana, sans-serif",
                fontSize: 11,
                fontWeight: 600,
                transition: "all 0.15s",
                background: active === s ? "#192537" : "#f4f7fa",
                color: active === s ? "white" : "#7a8a9e",
              }}
            >
              {s}
              {s !== "All" && (
                <span
                  style={{
                    marginLeft: 5,
                    background: active === s ? "rgba(127,226,227,0.25)" : "rgba(25,37,55,0.08)",
                    borderRadius: 999,
                    padding: "1px 6px",
                    fontSize: 10,
                  }}
                >
                  {projects.filter(p => (p.status || "Off-Plan") === s).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Project grid */}
      <div
        className="proj-micro-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}
      >
        {filtered.map(p => {
          const sc = STATUS_COLORS[p.status || "Off-Plan"] || STATUS_COLORS["Off-Plan"];
          return (
            <Link key={p.slug} href={`/projects/${p.slug}`} style={{ textDecoration: "none" }}>
              <div
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid #eef0f3",
                  background: "#f7f9fb",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = "translateY(-2px)";
                  el.style.boxShadow = "0 8px 24px rgba(25,37,55,0.1)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = "translateY(0)";
                  el.style.boxShadow = "none";
                }}
              >
                {p.image_main ? (
                  <div style={{ position: "relative" }}>
                    <img
                      src={p.image_main}
                      alt={p.name}
                      style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }}
                    />
                    {p.status && (
                      <span
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          fontSize: 9,
                          fontFamily: "Verdana, sans-serif",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: sc.bg,
                          color: sc.text,
                          backdropFilter: "blur(4px)",
                        }}
                      >
                        {p.status}
                      </span>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      height: 90,
                      background: "linear-gradient(135deg, #192537, #0d1e2e)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                    }}
                  >
                    🏙️
                  </div>
                )}
                <div style={{ padding: "10px 12px 12px" }}>
                  <div
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontWeight: 700,
                      fontSize: 12,
                      color: "#192537",
                      marginBottom: 4,
                      lineHeight: 1.3,
                    }}
                  >
                    {p.name}
                  </div>
                  {p.price_from && (
                    <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3" }}>
                      From AED {Number(p.price_from).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#aaa", textAlign: "center", padding: "32px 0" }}>
          No {active} projects listed yet.
        </p>
      )}

      <Link
        href={`/projects?dev=${encodeURIComponent(devName.split(" ")[0])}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginTop: 20,
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 700,
          fontSize: 12,
          color: "#7fe2e3",
          textDecoration: "none",
        }}
      >
        View all {devName} projects <ArrowUpRight size={13} />
      </Link>
    </div>
  );
}
