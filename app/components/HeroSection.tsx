"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import FilterBar, { FilterState } from "@/app/components/filter";
import ProjectResults, { Project } from "@/app/components/ProjectResults";

const rotatingWords = ["Dream Home", "Investment", "Future", "Lifestyle"];

function applyFilters(projects: Project[], filters: FilterState): Project[] {
  return projects.filter(p => {
    if (filters.projectSearch && !p.name.toLowerCase().includes(filters.projectSearch.toLowerCase())) return false;
    if (filters.areas.length && !filters.areas.some(a => p.area?.toLowerCase().includes(a.toLowerCase()))) return false;
    if (filters.developers.length && !filters.developers.some(d => p.developer?.toLowerCase().includes(d.toLowerCase()))) return false;
    if (filters.propertyTypes.length && !filters.propertyTypes.some(t => p.propertyTypes?.includes(t))) return false;
    if (p.priceFrom < filters.priceFrom || p.priceFrom > filters.priceTo) return false;
    return true;
  });
}

export default function HeroSection({ projects }: { projects: Project[] }) {
  const [wordIndex, setWordIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [activeFilters, setActiveFilters] = useState<FilterState | null>(null);
  const [results, setResults] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setWordIndex(i => (i + 1) % rotatingWords.length);
        setVisible(true);
      }, 400);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  const areas = [...new Set(projects.map(p => p.area).filter(Boolean))].sort();
  const developers = [...new Set(projects.map(p => p.developer).filter(Boolean))].sort();
  const projectNames = projects.map(p => p.name).filter(Boolean).sort();

  function handleSearch(filters: FilterState) {
    setLoading(true);
    setActiveFilters(filters);
    setTimeout(() => {
      setResults(applyFilters(projects, filters));
      setLoading(false);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }, 400);
  }

  return (
    <>
      <style>{`
        .hero-section {
          min-height: 100vh; background: #0d1e2e;
          display: flex; flex-direction: column;
          justify-content: center; align-items: center;
          position: relative; overflow: hidden;
          padding-top: 80px; padding-bottom: 80px;
          box-sizing: border-box;
        }
        .hero-inner {
          position: relative; z-index: 2;
          max-width: 1100px; width: 100%;
          padding: 0 32px; text-align: center;
          box-sizing: border-box;
        }
        .hero-h1 {
          font-family: var(--font-montserrat, sans-serif);
          font-weight: 700; color: white;
          font-size: clamp(38px, 6vw, 72px);
          line-height: 1.1; letter-spacing: -0.025em;
          margin-bottom: 32px;
        }
        .hero-word-wrap {
          display: block; width: 100%;
          text-align: center; min-height: 1.1em; overflow: hidden;
        }
        .hero-word {
          display: inline-block; color: #7fe2e3;
          transition: opacity 0.35s ease, transform 0.35s ease;
        }
        .hero-p {
          font-family: Verdana, sans-serif; font-size: 14px;
          color: rgba(255,255,255,0.45); line-height: 1.9;
          max-width: 480px; margin: 0 auto 40px; letter-spacing: 0.01em;
        }
        .hero-tags {
          display: flex; gap: 8px; justify-content: center;
          flex-wrap: wrap; margin-bottom: 48px;
        }
        .hero-tag {
          font-family: Verdana, sans-serif; font-size: 11px;
          color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07); border-radius: 999px;
          padding: 5px 14px; cursor: pointer; transition: all 0.2s;
        }
        .hero-tag:hover { color: #7fe2e3; border-color: rgba(127,226,227,0.3); }
        .hero-trust { display: flex; justify-content: center; gap: 40px; flex-wrap: wrap; }
        .hero-scroll-btn {
          position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          opacity: 0.35; background: none; border: none; cursor: pointer;
          transition: opacity 0.2s; z-index: 2;
        }
        .hero-scroll-btn:hover { opacity: 0.8; }
        @media (max-width: 700px) {
          .hero-inner { padding: 0 20px; }
          .hero-p { font-size: 13px; margin-bottom: 32px; }
          .hero-trust { gap: 24px; }
        }
      `}</style>

      <section className="hero-section">
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle, rgba(127,226,227,0.12) 1px, transparent 1px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)" }} />
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(127,226,227,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "15%", left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(127,226,227,0.06), transparent)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "20%", left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(127,226,227,0.04), transparent)", pointerEvents: "none" }} />

        <div className="hero-inner">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
            <div style={{ width: 32, height: 1, background: "#7fe2e3", opacity: 0.5 }} />
            <span style={{ fontFamily: "Verdana", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.35em", textTransform: "uppercase" }}>Dubai's Premium Real Estate Portal</span>
            <div style={{ width: 32, height: 1, background: "#7fe2e3", opacity: 0.5 }} />
          </div>

          <h1 className="hero-h1">
            Find Your
            <span className="hero-word-wrap">
              <span className="hero-word" style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)" }}>
                {rotatingWords[wordIndex]}
              </span>
            </span>
            <span style={{ color: "rgba(255,255,255,0.9)" }}>in Dubai</span>
          </h1>

          <p className="hero-p">
            1,200+ luxury properties. Off-plan & ready to move.<br />
            Discover your next chapter in the world's most dynamic city.
          </p>

          <div style={{ marginBottom: 24, width: "100%" }}>
            <FilterBar onSearch={handleSearch} onShowMap={() => console.log("show map")} areas={areas} developers={developers} projectNames={projectNames} />
          </div>

          <div className="hero-tags">
            {["Off-Plan 2025", "Palm Jumeirah", "Under AED 1M", "Dubai Marina", "Payment Plans"].map(tag => (
              <button key={tag} className="hero-tag">{tag}</button>
            ))}
          </div>

          <div className="hero-trust">
            {[["RERA Certified", "All agents licensed"], ["Zero Commission", "On select listings"], ["Free Consultation", "Book anytime"]].map(([title, sub]) => (
              <div key={title} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-montserrat, sans-serif)", fontWeight: 700, fontSize: 12, color: "rgba(255,255,255,0.8)", letterSpacing: "0.05em" }}>{title}</div>
                <div style={{ fontFamily: "Verdana", fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>

        <button className="hero-scroll-btn" onClick={() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}>
          <span style={{ fontFamily: "Verdana", fontSize: 9, color: "white", letterSpacing: "0.3em", textTransform: "uppercase" }}>Scroll</span>
          <ChevronDown size={14} color="white" />
        </button>
      </section>

      {(activeFilters !== null || loading) && (
        <div ref={resultsRef}>
          <ProjectResults projects={results} filters={activeFilters ?? undefined} loading={loading} />
        </div>
      )}
    </>
  );
}