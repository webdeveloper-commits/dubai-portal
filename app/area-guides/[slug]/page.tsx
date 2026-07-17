import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { Disclaimer, CookieBanner, FloatingContact } from "@/app/components/GlobalExtras";
import { FaqAccordion, LeadForm, PrimeLocationMap, EnquireButton } from "./ClientComponents";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommuteItem  { label: string; minutes: number }
interface SchoolItem   { name: string; type?: string; distance?: string }
interface HospitalItem { name: string; distance?: string }
interface MallItem     { name: string; distance?: string }
interface FaqItem      { q: string; a: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AreaRow = Record<string, any>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return "AED " + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  return "AED " + n.toLocaleString();
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabase
    .from("areas")
    .select("name,seo_title,seo_description,seo_keywords,hero_image")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!data) return { title: "Area Guide | Elysian Dubai" };

  const title = (data.seo_title || `${data.name} Area Guide — Buy, Rent & Invest | Elysian Dubai`) as string;
  const desc  = (data.seo_description || `Explore ${data.name} in Dubai: average property prices, rental yields, lifestyle, schools, hospitals and more.`) as string;

  return {
    title,
    description: desc,
    keywords: (data.seo_keywords as string) || undefined,
    openGraph: {
      title, description: desc, type: "website", siteName: "Elysian Dubai",
      images: data.hero_image ? [{ url: data.hero_image as string }] : [],
    },
    twitter: { card: "summary_large_image", title, description: desc },
    alternates: { canonical: `https://elysian.ae/area-guides/${slug}` },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AreaDetailPage({ params }: Props) {
  const { slug } = await params;

  const { data } = await supabase
    .from("areas")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!data) notFound();

  const area = data as AreaRow;

  const commuteTimes: CommuteItem[]  = Array.isArray(area.commute_times) ? area.commute_times : [];
  const schools:      SchoolItem[]   = Array.isArray(area.schools)       ? area.schools       : [];
  const hospitals:    HospitalItem[] = Array.isArray(area.hospitals)     ? area.hospitals     : [];
  const malls:        MallItem[]     = Array.isArray(area.malls)         ? area.malls         : [];
  const nearbyAreas:  string[]       = Array.isArray(area.nearby_areas)  ? area.nearby_areas  : [];
  const faqs:         FaqItem[]      = Array.isArray(area.faqs)          ? area.faqs.filter((f: FaqItem) => f.q && f.a) : [];
  const aboutParas:   string[]       = (area.about as string || "").split(/\n\n+/).filter(Boolean);

  // Fetch projects in this area (geo_summary contains the area name)
  const { data: areaProjects } = await supabase
    .from("projects")
    .select("name,slug,image_main,status,price_from,geo_summary,handover_quarter,handover_year,bedroom_min,bedroom_max")
    .ilike("geo_summary", `%${area.name}%`)
    .limit(6);

  function statusLabel(s: string): string {
    if (s === "ready" || s === "completed") return "Ready";
    if (s === "new_launch") return "New Launch";
    if (s === "off_plan")   return "Off-Plan";
    return s ?? "Off-Plan";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projects = (areaProjects ?? []).map((p: any) => ({
    name:      p.name as string,
    slug:      p.slug as string,
    image:     p.image_main as string | null,
    status:    statusLabel(p.status),
    priceFrom: p.price_from as number | null,
    handover:  [p.handover_quarter, p.handover_year].filter(Boolean).join(" ") || null,
    bedrooms:  p.bedroom_min != null && p.bedroom_max != null ? `${p.bedroom_min}–${p.bedroom_max} BR` : null,
  }));

  const hasPriceData = [
    area.avg_price_studio, area.avg_price_1br, area.avg_price_2br, area.avg_price_3br,
    area.avg_rent_studio,  area.avg_rent_1br,  area.avg_rent_2br,  area.avg_rent_3br,
  ].some(Boolean);

  const breadcrumbSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home",        item: "https://elysian.ae" },
      { "@type": "ListItem", position: 2, name: "Area Guides", item: "https://elysian.ae/area-guides" },
      { "@type": "ListItem", position: 3, name: area.name,     item: `https://elysian.ae/area-guides/${slug}` },
    ],
  });

  const faqSchema = faqs.length > 0 ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }) : null;

  return (
    <main style={{ background: "#f4f6f9" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqSchema }} />}

      <Navbar />

      {/* ── Hero ── */}
      <section
        style={{
          position: "relative",
          minHeight: 480,
          display: "flex",
          alignItems: "flex-end",
          overflow: "hidden",
          background: area.hero_image ? undefined : "linear-gradient(145deg, #0d1e2e 0%, #1a3a52 100%)",
        }}
      >
        {area.hero_image && (
          <img
            src={area.hero_image}
            alt={area.name}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(13,26,39,0.92) 0%, rgba(13,26,39,0.4) 60%, transparent 100%)",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            maxWidth: 1200,
            margin: "0 auto",
            padding: "100px 24px 52px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
            <Link href="/"            style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Home</Link>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>/</span>
            <Link href="/area-guides" style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Area Guides</Link>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>/</span>
            <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7fe2e3" }}>{area.name}</span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
            {area.roi_pct != null && (
              <span
                style={{
                  background: "rgba(25,37,55,0.75)",
                  backdropFilter: "blur(8px)",
                  color: "#7fe2e3",
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 12,
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(127,226,227,0.3)",
                }}
              >
                {area.roi_pct}% avg ROI
              </span>
            )}
            {area.best_for && (
              <span
                style={{
                  background: "rgba(255,255,255,0.1)",
                  backdropFilter: "blur(8px)",
                  color: "rgba(255,255,255,0.85)",
                  fontFamily: "Verdana, sans-serif",
                  fontSize: 11,
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                Best for: {area.best_for}
              </span>
            )}
          </div>

          <h1
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              fontSize: "clamp(28px, 5vw, 56px)",
              color: "white",
              margin: "0 0 10px",
              letterSpacing: "-0.025em",
              lineHeight: 1.08,
            }}
          >
            {area.name}
          </h1>
          {area.tagline && (
            <p
              style={{
                fontFamily: "Verdana, sans-serif",
                fontSize: 14,
                color: "rgba(255,255,255,0.6)",
                margin: 0,
                fontStyle: "italic",
              }}
            >
              {area.tagline}
            </p>
          )}
        </div>
      </section>

      {/* ── Main body ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "52px 24px 80px" }}>
        <div
          className="area-layout"
          style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 40, alignItems: "start" }}
        >

          {/* ── LEFT column ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

            {/* About + Highlights */}
            {(aboutParas.length > 0 || area.highlight_why_buy || area.highlight_who_lives || area.highlight_vibe) && (
              <div
                style={{
                  background: "white",
                  borderRadius: 20,
                  padding: "32px",
                  boxShadow: "0 2px 16px rgba(25,37,55,0.05)",
                }}
              >
                {(area.highlight_why_buy || area.highlight_who_lives || area.highlight_vibe) && (
                  <div
                    className="highlights-grid"
                    style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "#f0f0f0", borderRadius: 14, overflow: "hidden", marginBottom: 28 }}
                  >
                    {[
                      { label: "Why Buy Here",   value: area.highlight_why_buy },
                      { label: "Who Lives Here", value: area.highlight_who_lives },
                      { label: "The Vibe",       value: area.highlight_vibe },
                    ].filter(h => h.value).map(({ label, value }) => (
                      <div key={label} style={{ background: "white", padding: "18px 20px" }}>
                        <div
                          style={{
                            fontFamily: "Verdana, sans-serif",
                            fontSize: 9,
                            color: "#aaa",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            marginBottom: 6,
                          }}
                        >
                          {label}
                        </div>
                        <div
                          style={{
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 600,
                            fontSize: 13,
                            color: "#192537",
                            lineHeight: 1.4,
                          }}
                        >
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(area.highlight_best_streets) && (
                  <div style={{ marginBottom: 24, padding: "14px 18px", background: "rgba(127,226,227,0.07)", borderRadius: 12, border: "1px solid rgba(127,226,227,0.18)" }}>
                    <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#0d5e5f", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>Best Streets: </span>
                    <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#192537" }}>{area.highlight_best_streets}</span>
                  </div>
                )}

                <SectionHeading>About {area.name}</SectionHeading>
                {aboutParas.length > 0 ? (
                  aboutParas.map((p: string, i: number) => (
                    <p
                      key={i}
                      style={{
                        fontFamily: "Verdana, sans-serif",
                        fontSize: 13,
                        color: "#7a8a9e",
                        lineHeight: 1.9,
                        margin: i < aboutParas.length - 1 ? "0 0 16px" : 0,
                      }}
                    >
                      {p}
                    </p>
                  ))
                ) : (
                  <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", lineHeight: 1.9, margin: 0 }}>
                    {area.name} is one of Dubai's most sought-after communities, offering a blend of modern living and convenient access to the city's key destinations.
                  </p>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 22 }}>
                  {area.area_size && (
                    <InfoChip label="Area Size" value={area.area_size} />
                  )}
                  {area.roi_pct != null && (
                    <InfoChip label="Avg ROI" value={`${area.roi_pct}%`} highlight />
                  )}
                </div>
              </div>
            )}

            {/* Price Table */}
            {hasPriceData && (
              <div
                style={{
                  background: "white",
                  borderRadius: 20,
                  padding: "32px",
                  boxShadow: "0 2px 16px rgba(25,37,55,0.05)",
                  overflowX: "auto",
                }}
              >
                <SectionHeading>Property Prices &amp; Rental Yields</SectionHeading>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                  <thead>
                    <tr>
                      {["Unit Type", "Avg Sale Price", "Avg Rent / yr", "Price / sqft", "Est. ROI"].map((h, i) => (
                        <th
                          key={h}
                          style={{
                            fontFamily: "Verdana, sans-serif",
                            fontSize: 10,
                            color: "#aaa",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            padding: "0 12px 14px",
                            textAlign: i === 0 ? "left" : "right",
                            borderBottom: "2px solid #f0f0f0",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      {
                        label: "Studio",
                        price: area.avg_price_studio, rent: area.avg_rent_studio,
                        ppsf:  area.avg_ppsf_studio,  roi:  area.avg_roi_studio,
                      },
                      {
                        label: "1 Bedroom",
                        price: area.avg_price_1br, rent: area.avg_rent_1br,
                        ppsf:  area.avg_ppsf_1br,  roi:  area.avg_roi_1br,
                      },
                      {
                        label: "2 Bedrooms",
                        price: area.avg_price_2br, rent: area.avg_rent_2br,
                        ppsf:  area.avg_ppsf_2br,  roi:  area.avg_roi_2br,
                      },
                      {
                        label: "3 Bedrooms",
                        price: area.avg_price_3br, rent: area.avg_rent_3br,
                        ppsf:  area.avg_ppsf_3br,  roi:  area.avg_roi_3br,
                      },
                    ] as { label: string; price: number | null; rent: number | null; ppsf: number | null; roi: number | null }[])
                      .filter(r => r.price || r.rent || r.ppsf || r.roi)
                      .map((row, i) => (
                        <tr key={row.label}>
                          <td
                            style={{
                              fontFamily: "Montserrat, sans-serif",
                              fontWeight: 700,
                              fontSize: 13,
                              color: "#192537",
                              padding: "14px 12px",
                              borderBottom: "1px solid #f8f8f8",
                              background: i % 2 === 0 ? "white" : "#fafafa",
                            }}
                          >
                            {row.label}
                          </td>
                          <PriceCell value={row.price ? fmt(row.price) : "—"} highlight={false} even={i % 2 === 0} />
                          <PriceCell value={row.rent  ? fmt(row.rent)  : "—"} highlight={false} even={i % 2 === 0} />
                          <PriceCell value={row.ppsf  ? `AED ${row.ppsf.toLocaleString()}` : "—"} highlight={false} even={i % 2 === 0} />
                          <PriceCell value={row.roi   ? `${row.roi}%`  : "—"} highlight={row.roi != null} even={i % 2 === 0} />
                        </tr>
                      ))}
                  </tbody>
                </table>
                <p
                  style={{
                    fontFamily: "Verdana, sans-serif",
                    fontSize: 10,
                    color: "#bbb",
                    marginTop: 14,
                    margin: "14px 0 0",
                  }}
                >
                  Prices are indicative averages based on recent transactions. Contact us for current market data.
                </p>
              </div>
            )}

            {/* Lifestyle */}
            {(area.lifestyle_dining_text || area.lifestyle_parks_text || area.lifestyle_shopping_text) && (
              <div
                style={{
                  background: "white",
                  borderRadius: 20,
                  padding: "32px",
                  boxShadow: "0 2px 16px rgba(25,37,55,0.05)",
                }}
              >
                <SectionHeading>Lifestyle</SectionHeading>
                <div
                  className="lifestyle-grid"
                  style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}
                >
                  {[
                    { title: "Dining",    text: area.lifestyle_dining_text,   image: area.lifestyle_dining_image   },
                    { title: "Parks",     text: area.lifestyle_parks_text,    image: area.lifestyle_parks_image    },
                    { title: "Shopping",  text: area.lifestyle_shopping_text, image: area.lifestyle_shopping_image },
                  ].filter(c => c.text).map(({ title, text, image }) => (
                    <div
                      key={title}
                      style={{
                        borderRadius: 14,
                        overflow: "hidden",
                        border: "1px solid rgba(25,37,55,0.06)",
                        background: "#fafafa",
                      }}
                    >
                      {image ? (
                        <div style={{ aspectRatio: "4/3", overflow: "hidden" }}>
                          <img
                            src={image}
                            alt={title}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            aspectRatio: "4/3",
                            background: "linear-gradient(135deg, rgba(127,226,227,0.1) 0%, rgba(25,37,55,0.05) 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <span style={{ fontSize: 28 }}>
                            {title === "Dining" ? "🍽️" : title === "Parks" ? "🌿" : "🛍️"}
                          </span>
                        </div>
                      )}
                      <div style={{ padding: "14px 16px" }}>
                        <div
                          style={{
                            fontFamily: "Montserrat, sans-serif",
                            fontWeight: 700,
                            fontSize: 13,
                            color: "#192537",
                            marginBottom: 6,
                          }}
                        >
                          {title}
                        </div>
                        <p
                          style={{
                            fontFamily: "Verdana, sans-serif",
                            fontSize: 11,
                            color: "#7a8a9e",
                            lineHeight: 1.7,
                            margin: 0,
                          }}
                        >
                          {text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Map */}
            <PrimeLocationMap
              areaName={area.name}
              latitude={area.latitude ?? undefined}
              longitude={area.longitude ?? undefined}
            />

            {/* Commute Times */}
            {commuteTimes.length > 0 && (
              <div
                style={{
                  background: "white",
                  borderRadius: 20,
                  padding: "32px",
                  boxShadow: "0 2px 16px rgba(25,37,55,0.05)",
                }}
              >
                <SectionHeading>Commute Times</SectionHeading>
                <div
                  className="commute-grid"
                  style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}
                >
                  {commuteTimes.map((c) => (
                    <div
                      key={c.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "#f8fafc",
                        borderRadius: 12,
                        padding: "14px 18px",
                        border: "1px solid rgba(25,37,55,0.05)",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "Verdana, sans-serif",
                          fontSize: 12,
                          color: "#555",
                        }}
                      >
                        {c.label}
                      </span>
                      <span
                        style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          fontSize: 14,
                          color: "#192537",
                        }}
                      >
                        {c.minutes} min
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Amenities */}
            {(schools.length > 0 || hospitals.length > 0 || malls.length > 0) && (
              <div
                style={{
                  background: "white",
                  borderRadius: 20,
                  padding: "32px",
                  boxShadow: "0 2px 16px rgba(25,37,55,0.05)",
                }}
              >
                <SectionHeading>Nearby Amenities</SectionHeading>
                <div
                  className="amenities-cols"
                  style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}
                >
                  {schools.length > 0 && (
                    <AmenityColumn
                      title="Schools"
                      icon="🏫"
                      items={schools.map((s) => ({ name: s.name, sub: [s.type, s.distance].filter(Boolean).join(" · ") || undefined }))}
                    />
                  )}
                  {hospitals.length > 0 && (
                    <AmenityColumn
                      title="Healthcare"
                      icon="🏥"
                      items={hospitals.map((h) => ({ name: h.name, sub: h.distance || undefined }))}
                    />
                  )}
                  {malls.length > 0 && (
                    <AmenityColumn
                      title="Shopping"
                      icon="🛍️"
                      items={malls.map((m) => ({ name: m.name, sub: m.distance || undefined }))}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Projects in this area */}
            {projects.length > 0 && (
              <div style={{ background: "white", borderRadius: 20, padding: "32px", boxShadow: "0 2px 16px rgba(25,37,55,0.05)" }}>
                <SectionHeading>Projects in {area.name}</SectionHeading>
                <div className="area-proj-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                  {projects.map(p => {
                    const tagBg: Record<string, string> = { "Off-Plan": "#192537", "New Launch": "#f97316", "Ready": "#0f7a7b" };
                    const bg = tagBg[p.status] ?? "#192537";
                    return (
                      <Link key={p.slug} href={`/projects/${p.slug}`} style={{ textDecoration: "none" }}>
                        <div className="area-proj-card" style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #eef0f3", background: "#f7f9fb" }}>
                          {p.image
                            ? <div style={{ position: "relative" }}>
                                <img src={p.image} alt={p.name} style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />
                                <span style={{ position: "absolute", top: 8, left: 8, background: bg, color: "white", fontFamily: "Verdana,sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999 }}>{p.status}</span>
                              </div>
                            : <div style={{ height: 100, background: "linear-gradient(135deg,#192537,#0d1e2e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🏙️</div>
                          }
                          <div style={{ padding: "10px 12px 12px" }}>
                            <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 12, color: "#192537", lineHeight: 1.3, marginBottom: 4 }}>{p.name}</div>
                            {p.bedrooms && <div style={{ fontFamily: "Verdana,sans-serif", fontSize: 10, color: "#7a8a9e", marginBottom: 3 }}>{p.bedrooms}</div>}
                            {p.handover && <div style={{ fontFamily: "Verdana,sans-serif", fontSize: 10, color: "#7a8a9e", marginBottom: 3 }}>Handover {p.handover}</div>}
                            {p.priceFrom && <div style={{ fontFamily: "Verdana,sans-serif", fontSize: 10, color: "#7fe2e3", fontWeight: 700 }}>From AED {Number(p.priceFrom).toLocaleString()}</div>}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                <Link href={`/projects?area=${encodeURIComponent(area.name)}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 20, fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 12, color: "#7fe2e3", textDecoration: "none" }}>
                  View all {area.name} projects →
                </Link>
              </div>
            )}

            {/* FAQs */}
            {faqs.length > 0 && (
              <div
                style={{
                  background: "white",
                  borderRadius: 20,
                  padding: "32px",
                  boxShadow: "0 2px 16px rgba(25,37,55,0.05)",
                }}
              >
                <SectionHeading>Frequently Asked Questions</SectionHeading>
                {faqs.map((f, i) => (
                  <FaqAccordion key={i} q={f.q} a={f.a} />
                ))}
              </div>
            )}

            {/* Nearby Areas */}
            {nearbyAreas.length > 0 && (
              <div
                style={{
                  background: "white",
                  borderRadius: 20,
                  padding: "32px",
                  boxShadow: "0 2px 16px rgba(25,37,55,0.05)",
                }}
              >
                <SectionHeading>Nearby Areas</SectionHeading>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {nearbyAreas.map((name: string) => {
                    const nearbySlug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                    return (
                      <Link
                        key={name}
                        href={`/area-guides/${nearbySlug}`}
                        className="nearby-chip"
                        style={{
                          display: "inline-block",
                          background: "rgba(25,37,55,0.04)",
                          border: "1.5px solid rgba(25,37,55,0.1)",
                          color: "#192537",
                          fontFamily: "Verdana, sans-serif",
                          fontSize: 12,
                          padding: "8px 18px",
                          borderRadius: 999,
                          textDecoration: "none",
                          transition: "all 0.2s",
                        }}
                      >
                        {name} →
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* ── RIGHT sidebar ── */}
          <div className="area-sidebar" style={{ position: "sticky", top: 88 }}>

            {/* Agent card */}
            {area.agent_name && (
              <div
                style={{
                  background: "white",
                  borderRadius: 20,
                  padding: "24px",
                  boxShadow: "0 4px 28px rgba(25,37,55,0.09)",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                  {area.agent_photo ? (
                    <img
                      src={area.agent_photo}
                      alt={area.agent_name}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        objectFit: "cover",
                        flexShrink: 0,
                        border: "2px solid #f0f0f0",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #192537 0%, #1a4a60 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "Montserrat, sans-serif",
                          fontWeight: 700,
                          fontSize: 20,
                          color: "#7fe2e3",
                        }}
                      >
                        {area.agent_name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <div
                      style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        fontSize: 15,
                        color: "#192537",
                        marginBottom: 3,
                      }}
                    >
                      {area.agent_name}
                    </div>
                    <div
                      style={{
                        fontFamily: "Verdana, sans-serif",
                        fontSize: 11,
                        color: "#7a8a9e",
                      }}
                    >
                      {area.name} Specialist
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {area.agent_phone && (
                    <a
                      href={`tel:${area.agent_phone}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        width: "100%",
                        padding: "12px",
                        borderRadius: 12,
                        background: "#192537",
                        color: "white",
                        fontFamily: "Montserrat, sans-serif",
                        fontWeight: 700,
                        fontSize: 13,
                        textDecoration: "none",
                        boxSizing: "border-box",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                      Call Agent
                    </a>
                  )}
                  <EnquireButton areaName={area.name} />
                </div>
              </div>
            )}

            {/* Lead form */}
            <div
              style={{
                background: "white",
                borderRadius: 20,
                padding: "24px",
                boxShadow: "0 4px 28px rgba(25,37,55,0.09)",
              }}
            >
              <h3
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "#192537",
                  margin: "0 0 6px",
                }}
              >
                Enquire About {area.name}
              </h3>
              <p
                style={{
                  fontFamily: "Verdana, sans-serif",
                  fontSize: 11,
                  color: "#7a8a9e",
                  margin: "0 0 20px",
                  lineHeight: 1.6,
                }}
              >
                Get prices, availability and expert advice — free of charge.
              </p>
              <LeadForm areaName={area.name} />
            </div>

          </div>
        </div>
      </div>

      <div style={{ background: "white", borderTop: "1px solid #eee", padding: "20px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Link
            href="/area-guides"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              fontSize: 13,
              color: "#192537",
              textDecoration: "none",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M9.5 3L5 7.5 9.5 12" stroke="#192537" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back to all area guides
          </Link>
        </div>
      </div>

      <Footer />
      <Disclaimer />
      <CookieBanner />
      <FloatingContact />

      <style>{`
        .nearby-chip:hover { background: rgba(127,226,227,0.1) !important; border-color: #7fe2e3 !important; color: #0d5e5f !important; }
        .area-proj-card { transition: transform 0.2s, box-shadow 0.2s; }
        .area-proj-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(25,37,55,0.1); }
        @media (max-width: 1024px) {
          .area-layout       { grid-template-columns: 1fr !important; }
          .area-sidebar      { position: static !important; }
          .highlights-grid   { grid-template-columns: 1fr !important; }
          .amenities-cols    { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 768px) {
          .lifestyle-grid    { grid-template-columns: 1fr !important; }
          .commute-grid      { grid-template-columns: 1fr !important; }
          .area-proj-grid    { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 640px) {
          .amenities-cols    { grid-template-columns: 1fr !important; }
          .highlights-grid   { grid-template-columns: 1fr !important; }
          .area-proj-grid    { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}

// ─── Server-renderable sub-components ─────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
      <div style={{ width: 4, height: 22, background: "#7fe2e3", borderRadius: 2, flexShrink: 0 }} />
      <h2
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 700,
          fontSize: 20,
          color: "#192537",
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {children}
      </h2>
    </div>
  );
}

function InfoChip({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        background: highlight ? "rgba(127,226,227,0.1)" : "#f4f6f9",
        borderRadius: 12,
        padding: "10px 16px",
        border: highlight ? "1px solid rgba(127,226,227,0.25)" : "1px solid rgba(25,37,55,0.06)",
      }}
    >
      <span
        style={{
          fontFamily: "Verdana, sans-serif",
          fontSize: 9,
          color: highlight ? "#0d5e5f" : "#aaa",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 3,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "Montserrat, sans-serif",
          fontWeight: 700,
          fontSize: 14,
          color: highlight ? "#0d5e5f" : "#192537",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function PriceCell({ value, highlight, even }: { value: string; highlight: boolean; even: boolean }) {
  return (
    <td
      style={{
        fontFamily: highlight ? "Montserrat, sans-serif" : "Verdana, sans-serif",
        fontWeight: highlight ? 700 : 400,
        fontSize: 13,
        color: highlight ? "#7fe2e3" : "#555",
        padding: "14px 12px",
        textAlign: "right",
        borderBottom: "1px solid #f8f8f8",
        background: even ? "white" : "#fafafa",
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </td>
  );
}

function AmenityColumn({
  title,
  icon,
  items,
}: {
  title: string;
  icon: string;
  items: { name: string; sub?: string }[];
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: "2px solid #f0f0f0",
        }}
      >
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            fontSize: 13,
            color: "#192537",
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, i) => (
          <div key={i}>
            <div
              style={{
                fontFamily: "Verdana, sans-serif",
                fontSize: 12,
                color: "#333",
                marginBottom: 2,
                lineHeight: 1.4,
              }}
            >
              {item.name}
            </div>
            {item.sub && (
              <div
                style={{
                  fontFamily: "Verdana, sans-serif",
                  fontSize: 10,
                  color: "#aaa",
                }}
              >
                {item.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
