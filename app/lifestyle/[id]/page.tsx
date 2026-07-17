import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { Disclaimer, CookieBanner, FloatingContact } from "@/app/components/GlobalExtras";
import EnquireLifestyleButton from "./EnquireLifestyleButton";

// ─── Lifestyle catalogue ──────────────────────────────────────────────────────

const LIFESTYLES: Record<string, {
  label: string;
  description: string;
  longDesc: string;
  hero: string;
  keywords: string[];
  color: string;
}> = {
  waterfront: {
    label: "Waterfront Living",
    description: "Shimmering canal and creek views from your doorstep.",
    longDesc: "Waterfront properties in Dubai offer an unmatched lifestyle — wake up to panoramic water views, enjoy al fresco dining along the creek, and experience the serenity of living next to one of the world's most breathtaking waterfronts. From Dubai Creek Harbour to the iconic canals of Business Bay, these residences blend natural beauty with urban sophistication.",
    hero: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=90",
    keywords: ["waterfront", "canal", "creek", "marina"],
    color: "#0ea5e9",
  },
  golf: {
    label: "Golf Course Living",
    description: "Manicured fairways and green living in one address.",
    longDesc: "Golf course communities in Dubai combine the serenity of lush green fairways with world-class residential offerings. Residents enjoy exclusive access to championship golf courses, club facilities, and a tranquil environment that balances active outdoor living with refined elegance — all just minutes from the city.",
    hero: "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=1600&q=90",
    keywords: ["golf"],
    color: "#22c55e",
  },
  luxury: {
    label: "Luxury Properties",
    description: "Bespoke finishes and panoramic views at every turn.",
    longDesc: "Dubai's luxury real estate market is globally renowned for its extraordinary scale and craftsmanship. From sky-high penthouses with 360° city views to sprawling villas with private pools, these premium residences feature state-of-the-art smart home systems, marble finishes, and concierge services that redefine the meaning of luxury living.",
    hero: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&q=90",
    keywords: ["luxury", "premium", "ultra"],
    color: "#f59e0b",
  },
  branded: {
    label: "Branded Residences",
    description: "Live under the signature of the world's iconic brands.",
    longDesc: "Branded residences represent the pinnacle of prestige living — where globally iconic hospitality and fashion brands partner with Dubai's top developers to create homes that are as much a statement as they are a sanctuary. Owners enjoy hotel-grade services, brand-curated interiors, and access to exclusive amenities managed by world-class operators.",
    hero: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1600&q=90",
    keywords: ["branded"],
    color: "#8b5cf6",
  },
  beachfront: {
    label: "Beachfront Properties",
    description: "Step from your door onto pristine white sand.",
    longDesc: "Dubai's beachfront properties offer direct access to the Arabian Gulf's azure waters and white sandy shores. From Palm Jumeirah's iconic villas to the pristine beaches of JBR, these residences let you enjoy a true island lifestyle without compromise — year-round sunshine, water sports at your doorstep, and sunset views that never get old.",
    hero: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=1600&q=90",
    keywords: ["beachfront", "beach"],
    color: "#7fe2e3",
  },
  community: {
    label: "Community Living",
    description: "Family-friendly gated communities with parks and retail.",
    longDesc: "Community living in Dubai means belonging to a vibrant, well-planned neighbourhood where everything you need is within walking distance. Gated communities offer top-rated schools, retail centres, parks, sports facilities, and dedicated cycling and jogging tracks — creating a safe, social environment perfect for families and those who value connection.",
    hero: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1600&q=90",
    keywords: ["community", "family", "gated"],
    color: "#f97316",
  },
};

// ─── Metadata ─────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const ls = LIFESTYLES[id];
  if (!ls) return { title: "Lifestyle | Elysian Dubai" };
  return {
    title: `${ls.label} Properties in Dubai | Elysian Real Estate`,
    description: `${ls.description} Browse our curated selection of ${ls.label.toLowerCase()} properties across Dubai.`,
    alternates: { canonical: `https://elysian.ae/lifestyle/${id}` },
    openGraph: {
      title: `${ls.label} Properties in Dubai`,
      description: ls.description,
      images: [{ url: ls.hero }],
    },
  };
}

export async function generateStaticParams() {
  return Object.keys(LIFESTYLES).map(id => ({ id }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return "AED " + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  return "AED " + n.toLocaleString();
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  "Off-Plan":   { bg: "#192537",  color: "#7fe2e3" },
  "Ready":      { bg: "#7fe2e3",  color: "#192537" },
  "New Launch": { bg: "#f97316",  color: "white"   },
};

function statusLabel(s: string): string {
  if (s === "ready" || s === "completed") return "Ready";
  if (s === "new_launch") return "New Launch";
  return "Off-Plan";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const revalidate = 3600;

export default async function LifestylePage({ params }: Props) {
  const { id } = await params;
  const ls = LIFESTYLES[id];
  if (!ls) notFound();

  // Fetch all published projects, filter by lifestyle_tags client-side
  // (lifestyle_tags is a JSON array, so we use contains or ilike per keyword)
  const orConditions = ls.keywords
    .map(kw => `lifestyle_tags.cs.{"${kw}"}`)
    .join(",");

  const { data: rawProjects } = await supabase
    .from("projects")
    .select("id,name,slug,status,price_from,handover_quarter,handover_year,bedroom_min,bedroom_max,image_main,images_all,geo_summary,developer_slug,lifestyle_tags")
    .eq("is_published", true)
    .or(orConditions)
    .order("created_at", { ascending: false })
    .limit(30);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projects = (rawProjects ?? []).map((p: any) => ({
    id:        p.id as string,
    name:      p.name as string,
    slug:      p.slug as string,
    status:    statusLabel(p.status),
    priceFrom: (p.price_from as number) ?? 0,
    handover:  [p.handover_quarter, p.handover_year].filter(Boolean).join(" ") || null,
    bedrooms:  p.bedroom_min != null && p.bedroom_max != null ? `${p.bedroom_min}–${p.bedroom_max} BR` : null,
    image:     (p.image_main as string) ?? ((p.images_all as string[])?.[0] ?? ""),
    area:      (p.geo_summary as string) ?? "Dubai, UAE",
    developer: ((p.developer_slug as string) ?? "").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
  }));

  // Other lifestyle categories for navigation
  const otherLifestyles = Object.entries(LIFESTYLES).filter(([k]) => k !== id);

  return (
    <main style={{ background: "#f4f6f9" }}>
      <Navbar />

      {/* ── HERO ── */}
      <section style={{ position: "relative", minHeight: 520, display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
        <img
          src={ls.hero}
          alt={ls.label}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(13,30,46,0.3) 0%, rgba(13,30,46,0.92) 100%)" }} />

        <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1200, margin: "0 auto", padding: "120px 24px 60px", boxSizing: "border-box" }}>

          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            <Link href="/" style={{ fontFamily: "Verdana", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Home</Link>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
            <span style={{ fontFamily: "Verdana", fontSize: 11, color: "#7fe2e3" }}>Lifestyle</span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
            <span style={{ fontFamily: "Verdana", fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{ls.label}</span>
          </div>

          <div style={{ display: "inline-block", background: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 999, padding: "6px 18px", marginBottom: 20 }}>
            <span style={{ fontFamily: "Verdana", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.28em", textTransform: "uppercase" }}>Lifestyle Category</span>
          </div>

          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "clamp(30px,5vw,58px)", color: "white", margin: "0 0 16px", letterSpacing: "-0.03em", lineHeight: 1.05 }}>
            {ls.label}
          </h1>
          <p style={{ fontFamily: "Verdana", fontSize: 14, color: "rgba(255,255,255,0.65)", margin: "0 0 32px", maxWidth: 600, lineHeight: 1.8 }}>
            {ls.description}
          </p>

          <div style={{ display: "inline-flex", alignItems: "center", gap: 16, background: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", border: "1px solid rgba(127,226,227,0.2)", borderRadius: 16, padding: "14px 24px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#7fe2e3" }}>{projects.length}</div>
              <div style={{ fontFamily: "Verdana", fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Projects Listed</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ABOUT SECTION ── */}
      <section style={{ background: "#192537", padding: "56px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontFamily: "Verdana", fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 2, margin: 0 }}>
            {ls.longDesc}
          </p>
        </div>
      </section>

      {/* ── PROJECTS GRID ── */}
      <section style={{ padding: "64px 24px 96px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>

          <div style={{ marginBottom: 40, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <p style={{ fontFamily: "Verdana", fontSize: 11, color: "#7fe2e3", letterSpacing: "0.28em", textTransform: "uppercase", margin: "0 0 8px" }}>
                Available Properties
              </p>
              <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(22px,3vw,34px)", color: "#192537", margin: 0, letterSpacing: "-0.02em" }}>
                {ls.label} Projects
              </h2>
            </div>
            <Link
              href={`/projects?life=${id}`}
              style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12, color: "#7fe2e3", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              View with full filter →
            </Link>
          </div>

          {projects.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 20, color: "#192537", marginBottom: 12 }}>
                No projects found for this lifestyle
              </p>
              <p style={{ fontFamily: "Verdana", fontSize: 13, color: "#7a8a9e", marginBottom: 24 }}>
                New projects are added regularly. Enquire below and we'll notify you.
              </p>
            </div>
          ) : (
            <div className="lifestyle-proj-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 28 }}>
              {projects.map(p => {
                const sc = STATUS_COLORS[p.status] ?? STATUS_COLORS["Off-Plan"];
                return (
                  <Link key={p.id} href={`/projects/${p.slug}`} style={{ textDecoration: "none", display: "block" }}>
                    <article
                      className="ls-card"
                      style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 20px rgba(25,37,55,0.06)", border: "1px solid rgba(25,37,55,0.06)", transition: "transform 0.25s, box-shadow 0.25s", height: "100%", display: "flex", flexDirection: "column" }}
                    >
                      <div style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", flexShrink: 0 }}>
                        {p.image
                          ? <img src={p.image} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.4s ease" }} />
                          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#192537,#0d1e2e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🏙️</div>
                        }
                        <span style={{ position: "absolute", top: 14, left: 14, background: sc.bg, color: sc.color, fontFamily: "Verdana", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "5px 13px", borderRadius: 999 }}>
                          {p.status}
                        </span>
                      </div>
                      <div style={{ padding: "20px 22px 22px", flex: 1, display: "flex", flexDirection: "column" }}>
                        <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "#192537", margin: "0 0 4px", lineHeight: 1.25 }}>{p.name}</h3>
                        {p.developer && <p style={{ fontFamily: "Verdana", fontSize: 11, color: "#7a8a9e", margin: "0 0 12px" }}>by {p.developer}</p>}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                          {p.area     && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#f4f7fa", borderRadius: 999, padding: "4px 10px", fontFamily: "Verdana", fontSize: 10, color: "#555" }}>📍 {p.area}</span>}
                          {p.bedrooms && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#f4f7fa", borderRadius: 999, padding: "4px 10px", fontFamily: "Verdana", fontSize: 10, color: "#555" }}>🛏 {p.bedrooms}</span>}
                          {p.handover && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#f4f7fa", borderRadius: 999, padding: "4px 10px", fontFamily: "Verdana", fontSize: 10, color: "#555" }}>📅 {p.handover}</span>}
                        </div>
                        <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          {p.priceFrom > 0
                            ? <div>
                                <div style={{ fontFamily: "Verdana", fontSize: 10, color: "#bbb", marginBottom: 2 }}>from</div>
                                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 17, color: "#192537" }}>{fmt(p.priceFrom)}</div>
                              </div>
                            : <span style={{ fontFamily: "Verdana", fontSize: 11, color: "#7a8a9e" }}>Contact for price</span>
                          }
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#192537", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 12L12 2M12 2H5M12 2V9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={{ background: "#192537", padding: "64px 24px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontFamily: "Verdana", fontSize: 11, color: "#7fe2e3", letterSpacing: "0.28em", textTransform: "uppercase", margin: "0 0 16px" }}>
            Expert Guidance
          </p>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(22px,3.5vw,36px)", color: "white", margin: "0 0 16px", letterSpacing: "-0.02em" }}>
            Find Your Perfect {ls.label.split(" ")[0]} Home
          </h2>
          <p style={{ fontFamily: "Verdana", fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.9, margin: "0 0 32px" }}>
            Our property advisors specialize in {ls.label.toLowerCase()} properties and can help you find the right investment or home.
          </p>
          <EnquireLifestyleButton lifestyleLabel={ls.label} />
        </div>
      </section>

      {/* ── OTHER LIFESTYLES ── */}
      <section style={{ background: "white", padding: "64px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontFamily: "Verdana", fontSize: 11, color: "#7fe2e3", letterSpacing: "0.28em", textTransform: "uppercase", margin: "0 0 12px" }}>Explore More</p>
            <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(20px,3vw,32px)", color: "#192537", margin: 0, letterSpacing: "-0.02em" }}>
              Other Lifestyle Categories
            </h2>
          </div>
          <div className="other-ls-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {otherLifestyles.map(([key, info]) => (
              <Link key={key} href={`/lifestyle/${key}`} style={{ textDecoration: "none" }}>
                <div className="other-ls-card" style={{ position: "relative", borderRadius: 20, overflow: "hidden", aspectRatio: "16/9", transition: "transform 0.25s" }}>
                  <img src={info.hero} alt={info.label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(13,30,46,0.85) 0%, rgba(13,30,46,0.1) 100%)" }} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "18px 20px" }}>
                    <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "white", margin: "0 0 4px", lineHeight: 1.2 }}>{info.label}</h3>
                    <p style={{ fontFamily: "Verdana", fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0 }}>{info.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
      <Disclaimer />
      <CookieBanner />
      <FloatingContact />

      <style>{`
        .ls-card:hover { transform: translateY(-4px); box-shadow: 0 14px 44px rgba(25,37,55,0.13) !important; }
        .ls-card:hover img { transform: scale(1.05); }
        .other-ls-card:hover { transform: translateY(-3px); }
        @media (max-width: 1024px) {
          .lifestyle-proj-grid { grid-template-columns: repeat(2,1fr) !important; }
          .other-ls-grid       { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 640px) {
          .lifestyle-proj-grid { grid-template-columns: 1fr !important; }
          .other-ls-grid       { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
