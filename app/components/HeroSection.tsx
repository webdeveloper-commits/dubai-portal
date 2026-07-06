"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import FilterBar, { FilterState } from "@/app/components/filter";
import ProjectResults, { Project } from "@/app/components/ProjectResults";

const rotatingWords = ["Dream Home", "Investment", "Future", "Lifestyle"];

// ─── Demo data — replace with Supabase fetch in Session 6 ────────────────────
const DEMO_PROJECTS: Project[] = [
  { id: "1", name: "Le Château by BEYOND", developer: "BEYOND Developments", area: "Dubai Marina", propertyTypes: ["Apartments", "Penthouses"], priceFrom: 2_800_000, handover: "Q4 2026", bedrooms: "1–4 BR", image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=80", tag: "Off-Plan", slug: "le-chateau-beyond" },
  { id: "2", name: "Emaar Beachfront", developer: "Emaar Properties", area: "Dubai Harbour", propertyTypes: ["Apartments"], priceFrom: 1_950_000, handover: "Q2 2026", bedrooms: "1–3 BR", image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80", tag: "Ready", slug: "emaar-beachfront" },
  { id: "3", name: "DAMAC Lagoons", developer: "DAMAC Properties", area: "DAMAC Hills", propertyTypes: ["Villas", "Townhouses"], priceFrom: 1_200_000, handover: "Q1 2027", bedrooms: "3–6 BR", image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&q=80", tag: "New Launch", slug: "damac-lagoons" },
  { id: "4", name: "Sobha Hartland II", developer: "Sobha Realty", area: "MBR City", propertyTypes: ["Apartments", "Villas"], priceFrom: 900_000, handover: "Q3 2026", bedrooms: "Studio–4 BR", image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80", slug: "sobha-hartland-ii" },
  { id: "5", name: "Nakheel Palm Beach Towers", developer: "Nakheel", area: "Palm Jumeirah", propertyTypes: ["Apartments", "Penthouses"], priceFrom: 3_500_000, handover: "Q4 2027", bedrooms: "1–5 BR", image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80", tag: "Off-Plan", slug: "palm-beach-towers" },
  { id: "6", name: "Binghatti Nova", developer: "Binghatti", area: "JVC", propertyTypes: ["Apartments", "Studios"], priceFrom: 650_000, handover: "Q2 2025", bedrooms: "Studio–2 BR", image: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=600&q=80", tag: "Ready", slug: "binghatti-nova" },
  { id: "7", name: "Ellington Cove", developer: "Ellington Properties", area: "Dubai Creek Harbour", propertyTypes: ["Apartments"], priceFrom: 1_400_000, handover: "Q3 2027", bedrooms: "1–3 BR", image: "https://images.unsplash.com/photo-1571939228382-b2f2b585ce15?w=600&q=80", tag: "Off-Plan", slug: "ellington-cove" },
  { id: "8", name: "Aldar Yas Park Views", developer: "Aldar", area: "Yas Island", propertyTypes: ["Apartments", "Townhouses"], priceFrom: 780_000, handover: "Q1 2026", bedrooms: "1–4 BR", image: "https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=600&q=80", slug: "yas-park-views" },
 { id: "9", name: "Le Château by BEYOND", developer: "BEYOND Developments", area: "Dubai Marina", propertyTypes: ["Apartments", "Penthouses"], priceFrom: 2_800_000, handover: "Q4 2026", bedrooms: "1–4 BR", image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=80", tag: "Off-Plan", slug: "le-chateau-beyond" },
  { id: "10", name: "Emaar Beachfront", developer: "Emaar Properties", area: "Dubai Harbour", propertyTypes: ["Apartments"], priceFrom: 1_950_000, handover: "Q2 2026", bedrooms: "1–3 BR", image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80", tag: "Ready", slug: "emaar-beachfront" },
  { id: "11", name: "DAMAC Lagoons", developer: "DAMAC Properties", area: "DAMAC Hills", propertyTypes: ["Villas", "Townhouses"], priceFrom: 1_200_000, handover: "Q1 2027", bedrooms: "3–6 BR", image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&q=80", tag: "New Launch", slug: "damac-lagoons" },
  { id: "12", name: "Sobha Hartland II", developer: "Sobha Realty", area: "MBR City", propertyTypes: ["Apartments", "Villas"], priceFrom: 900_000, handover: "Q3 2026", bedrooms: "Studio–4 BR", image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80", slug: "sobha-hartland-ii" },
  { id: "13", name: "Nakheel Palm Beach Towers", developer: "Nakheel", area: "Palm Jumeirah", propertyTypes: ["Apartments", "Penthouses"], priceFrom: 3_500_000, handover: "Q4 2027", bedrooms: "1–5 BR", image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80", tag: "Off-Plan", slug: "palm-beach-towers" },
  { id: "14", name: "Binghatti Nova", developer: "Binghatti", area: "JVC", propertyTypes: ["Apartments", "Studios"], priceFrom: 650_000, handover: "Q2 2025", bedrooms: "Studio–2 BR", image: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=600&q=80", tag: "Ready", slug: "binghatti-nova" },
  { id: "15", name: "Ellington Cove", developer: "Ellington Properties", area: "Dubai Creek Harbour", propertyTypes: ["Apartments"], priceFrom: 1_400_000, handover: "Q3 2027", bedrooms: "1–3 BR", image: "https://images.unsplash.com/photo-1571939228382-b2f2b585ce15?w=600&q=80", tag: "Off-Plan", slug: "ellington-cove" },
  { id: "16", name: "Aldar Yas Park Views", developer: "Aldar", area: "Yas Island", propertyTypes: ["Apartments", "Townhouses"], priceFrom: 780_000, handover: "Q1 2026", bedrooms: "1–4 BR", image: "https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=600&q=80", slug: "yas-park-views" },


];

function applyFilters(projects: Project[], filters: FilterState): Project[] {
  return projects.filter(p => {
    if (filters.projectSearch && !p.name.toLowerCase().includes(filters.projectSearch.toLowerCase())) return false;
    if (filters.areas.length && !filters.areas.includes(p.area)) return false;
    if (filters.developers.length && !filters.developers.some(d => p.developer.includes(d))) return false;
    if (filters.propertyTypes.length && !filters.propertyTypes.some(t => p.propertyTypes.includes(t))) return false;
    if (p.priceFrom < filters.priceFrom || p.priceFrom > filters.priceTo) return false;
    return true;
  });
}

export default function HeroSection() {
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

  function handleSearch(filters: FilterState) {
    setLoading(true);
    setActiveFilters(filters);
    setTimeout(() => {
      setResults(applyFilters(DEMO_PROJECTS, filters));
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
            <FilterBar onSearch={handleSearch} onShowMap={() => console.log("show map")} />
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