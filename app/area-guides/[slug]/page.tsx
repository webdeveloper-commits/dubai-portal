import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { FaqAccordion, LeadForm, PrimeLocationMap, EnquireButton } from "./ClientComponents";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FaqItem { q: string; a: string }

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

  // Commute times: array of {label, minutes} objects OR newline-separated string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawCommute = area.commute_times as any;
  let commuteLines: string[] = [];
  if (rawCommute) {
    if (Array.isArray(rawCommute)) {
      commuteLines = rawCommute
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => {
          if (typeof c === "string") return c;
          const label = c.label ?? c.name ?? c.destination ?? "";
          const mins  = c.minutes ?? c.time ?? c.duration ?? "";
          return mins ? `${label} — ${mins} min` : label;
        })
        .filter(Boolean);
    } else if (typeof rawCommute === "string") {
      commuteLines = rawCommute.split("\n").map((s: string) => s.trim()).filter(Boolean);
    }
  }

  // Schools / hospitals / malls: may be arrays of strings OR {name, distance} objects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schools:   any[] = Array.isArray(area.schools)   ? area.schools   : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hospitals: any[] = Array.isArray(area.hospitals) ? area.hospitals : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const malls:     any[] = Array.isArray(area.malls)     ? area.malls     : [];

  // Nearby areas: may be strings or {name} objects
  const nearbyAreas: string[] = Array.isArray(area.nearby_areas)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? area.nearby_areas.map((n: any) => typeof n === "string" ? n : n.name ?? "").filter(Boolean)
    : [];

  // FAQs: try aeo_faq first ({question, answer}), then faqs ({q, a})
  let faqs: FaqItem[] = [];
  const rawAeoFaq = area.aeo_faq;
  const rawFaqs   = area.faqs;
  if (Array.isArray(rawAeoFaq) && rawAeoFaq.length > 0) {
    faqs = rawAeoFaq
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((f: any) => ({ q: f.question ?? f.q ?? "", a: f.answer ?? f.a ?? "" }))
      .filter((f: FaqItem) => f.q && f.a);
  }
  if (faqs.length === 0 && Array.isArray(rawFaqs) && rawFaqs.length > 0) {
    faqs = rawFaqs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((f: any) => ({ q: f.q ?? f.question ?? "", a: f.a ?? f.answer ?? "" }))
      .filter((f: FaqItem) => f.q && f.a);
  }

  const aboutParas: string[] = (area.about as string || "").split(/\n\n+/).filter(Boolean);

  // Fetch projects in this area + all published area slugs (for nearby-areas linking)
  const [{ data: areaProjects }, { data: publishedAreasData }] = await Promise.all([
    supabase
      .from("projects")
      .select("name,slug,image_main,status,price_from,geo_summary,handover_quarter,handover_year,bedroom_min,bedroom_max")
      .ilike("geo_summary", `%${area.name}%`)
      .limit(6),
    supabase
      .from("areas")
      .select("name, slug")
      .eq("is_published", true),
  ]);

  // Map: lowercase area name → slug (for nearby areas lookup)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const publishedAreaLookup = new Map<string, string>(
    (publishedAreasData ?? []).map((a: any) => [
      (a.name as string).toLowerCase().trim(),
      a.slug as string,
    ])
  );

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

  // Starting price for hero card
  const heroStartPrice = area.avg_price_studio || area.avg_price_1br || area.avg_price_2br || area.avg_price_3br;

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

  // nearby_areas: if any item > 60 chars → render as text, not chips
  const nearbyAsChips = nearbyAreas.every((n: string) => n.length < 60);

  // amenities: if any raw item is a long paragraph → switch to prose layout
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const amenitiesAreProse = [...schools, ...hospitals, ...malls].some((item: any) =>
    typeof item === "string" && item.length > 80
  );

  return (
    <main style={{ background: "#f4f6f9" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqSchema }} />}

      {/* ── HERO ── */}
      <section
        style={{
          position: "relative",
          minHeight: "68vh",
          display: "flex",
          alignItems: "stretch",
          overflow: "hidden",
          background: area.hero_image ? undefined : "linear-gradient(145deg, #0d1e2e 0%, #1a3a52 100%)",
        }}
      >
        {area.hero_image && (
          <img
            src={area.hero_image}
            alt={area.name}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
        {/* Bottom-heavy dark gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(13,26,39,0.95) 0%, rgba(13,26,39,0.55) 45%, rgba(13,26,39,0.15) 100%)",
          }}
        />

        {/* Content wrapper — fills full hero height */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* ── TOP ROW: Breadcrumb (left) + Badges (right) ── */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              paddingTop: 100,
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Link href="/"            style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Home</Link>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>/</span>
              <Link href="/area-guides" style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Area Guides</Link>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>/</span>
              <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7fe2e3" }}>{area.name}</span>
            </div>

            {/* Badges: ROI + Best For */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {area.roi_pct != null && (
                <span style={{ background: "rgba(127,226,227,0.18)", backdropFilter: "blur(10px)", color: "#7fe2e3", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12, padding: "7px 16px", borderRadius: 999, border: "1px solid rgba(127,226,227,0.4)" }}>
                  {area.roi_pct}% avg ROI
                </span>
              )}
              {area.best_for && (
                <span style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(10px)", color: "rgba(255,255,255,0.9)", fontFamily: "Verdana, sans-serif", fontSize: 11, padding: "7px 16px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)" }}>
                  Best for: {area.best_for}
                </span>
              )}
            </div>
          </div>

          {/* ── BOTTOM ROW: Area name/tagline (left) + Price card (right) ── */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 24,
              paddingBottom: 52,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  fontSize: "clamp(32px, 5.5vw, 64px)",
                  color: "white",
                  margin: "0 0 10px",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.05,
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
                    lineHeight: 1.6,
                  }}
                >
                  {area.tagline}
                </p>
              )}
            </div>

            {/* Floating price card */}
            {heroStartPrice && (
              <div
                style={{
                  background: "rgba(255,255,255,0.1)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(127,226,227,0.25)",
                  borderRadius: 18,
                  padding: "18px 24px",
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "rgba(255,255,255,0.45)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>
                  Starting from
                </div>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "clamp(18px,2.5vw,28px)", color: "white", letterSpacing: "-0.02em" }}>
                  {fmt(heroStartPrice)}
                </div>
                <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
                  avg. sale price
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      {(area.roi_pct != null || area.area_size || area.emirate || area.best_for) && (
        <div style={{ background: "#192537" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
            <div
              className="stats-strip"
              style={{ display: "flex", overflowX: "auto" }}
            >
              {[
                area.roi_pct   != null ? { icon: "📈", label: "Average ROI",  value: `${area.roi_pct}%`      } : null,
                area.area_size         ? { icon: "📐", label: "Area Size",    value: area.area_size as string } : null,
                area.emirate           ? { icon: "🏙️", label: "Emirate",      value: area.emirate as string  } : null,
                area.best_for          ? { icon: "⭐", label: "Best For",     value: area.best_for as string  } : null,
              ].filter(Boolean).map((item, i, arr) => (
                <div
                  key={item!.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "18px 28px",
                    flexShrink: 0,
                    borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "rgba(127,226,227,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    {item!.icon}
                  </div>
                  <div>
                    <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "rgba(255,255,255,0.38)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>
                      {item!.label}
                    </div>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "white", whiteSpace: "nowrap" }}>
                      {item!.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN BODY ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "52px 24px 80px" }}>
        <div
          className="area-layout"
          style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 40, alignItems: "start" }}
        >

          {/* ── LEFT COLUMN ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

            {/* 1. About + Highlights */}
            {(aboutParas.length > 0 || area.highlight_why_buy || area.highlight_who_lives || area.highlight_vibe) && (
              <div style={{ background: "white", borderRadius: 20, padding: "32px", boxShadow: "0 2px 16px rgba(25,37,55,0.05)" }}>

                {/* Highlights 3-col grid — only when ≥2 of the 3 fields have data */}
                {(area.highlight_why_buy || area.highlight_who_lives) && (
                  <div
                    className="highlights-grid"
                    style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, marginBottom: 28, borderRadius: 16, overflow: "hidden", border: "1px solid #f0f0f0" }}
                  >
                    {[
                      { label: "Why Buy Here",   value: area.highlight_why_buy   },
                      { label: "Who Lives Here", value: area.highlight_who_lives },
                      { label: "The Vibe",       value: area.highlight_vibe      },
                    ].filter(h => h.value).map(({ label, value }, idx) => (
                      <div
                        key={label}
                        style={{
                          background: "white",
                          padding: "20px 22px",
                          borderLeft: idx > 0 ? "1px solid #f0f0f0" : "3px solid #7fe2e3",
                          position: "relative",
                        }}
                      >
                        <div style={{ width: 3, height: "100%", background: "#7fe2e3", position: "absolute", left: 0, top: 0, bottom: 0, display: idx === 0 ? "block" : "none" }} />
                        <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "#aaa", letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 7 }}>
                          {label}
                        </div>
                        <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, fontSize: 13, color: "#192537", lineHeight: 1.55 }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Best Streets chip */}
                {area.highlight_best_streets && (
                  <div style={{ marginBottom: 24, padding: "13px 18px", background: "rgba(127,226,227,0.07)", borderRadius: 12, border: "1px solid rgba(127,226,227,0.18)" }}>
                    <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#0d5e5f", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>Best Streets: </span>
                    <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#192537" }}>{area.highlight_best_streets}</span>
                  </div>
                )}

                <SectionHeading>About {area.name}</SectionHeading>
                {aboutParas.length > 0 ? (
                  aboutParas.map((p: string, i: number) => (
                    <p
                      key={i}
                      style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", lineHeight: 1.9, margin: i < aboutParas.length - 1 ? "0 0 16px" : 0 }}
                    >
                      {p}
                    </p>
                  ))
                ) : (
                  <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", lineHeight: 1.9, margin: 0 }}>
                    {area.name} is one of Dubai&apos;s most sought-after communities, offering a blend of modern living and convenient access to the city&apos;s key destinations.
                  </p>
                )}

                {/* Key Facts — vibe bullet points (only shown when why_buy/who_lives are absent) */}
                {area.highlight_vibe && !area.highlight_why_buy && !area.highlight_who_lives && (() => {
                  const vibeLines = (area.highlight_vibe as string).split(/\n+/).map((l: string) => l.trim()).filter(Boolean);
                  return vibeLines.length > 0 ? (
                    <div style={{ marginTop: aboutParas.length > 0 ? 24 : 0, padding: "20px 22px", background: "rgba(127,226,227,0.05)", borderRadius: 14, border: "1px solid rgba(127,226,227,0.18)" }}>
                      <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "#0d5e5f", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: 14 }}>
                        Key Facts
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {vibeLines.map((line: string, i: number) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: "1px solid rgba(127,226,227,0.2)", borderRadius: 999, padding: "6px 14px" }}>
                            <span style={{ color: "#7fe2e3", fontSize: 10, fontWeight: 700 }}>✓</span>
                            <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#192537" }}>{line}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

                {(area.area_size || area.roi_pct != null) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 22 }}>
                    {area.area_size   && <InfoChip label="Area Size" value={area.area_size} />}
                    {area.roi_pct != null && <InfoChip label="Avg ROI" value={`${area.roi_pct}%`} highlight />}
                  </div>
                )}
              </div>
            )}

            {/* 2. Property Prices & Rental Yields */}
            {hasPriceData && (
              <div style={{ background: "white", borderRadius: 20, padding: "32px", boxShadow: "0 2px 16px rgba(25,37,55,0.05)", overflowX: "auto" }}>
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
                      { label: "Studio",     price: area.avg_price_studio, rent: area.avg_rent_studio, ppsf: area.avg_ppsf_studio, roi: area.avg_roi_studio },
                      { label: "1 Bedroom",  price: area.avg_price_1br,    rent: area.avg_rent_1br,    ppsf: area.avg_ppsf_1br,    roi: area.avg_roi_1br    },
                      { label: "2 Bedrooms", price: area.avg_price_2br,    rent: area.avg_rent_2br,    ppsf: area.avg_ppsf_2br,    roi: area.avg_roi_2br    },
                      { label: "3 Bedrooms", price: area.avg_price_3br,    rent: area.avg_rent_3br,    ppsf: area.avg_ppsf_3br,    roi: area.avg_roi_3br    },
                    ] as { label: string; price: number | null; rent: number | null; ppsf: number | null; roi: number | null }[])
                      .filter(r => r.price || r.rent || r.ppsf || r.roi)
                      .map((row, i) => (
                        <tr key={row.label}>
                          <td style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#192537", padding: "14px 12px", borderBottom: "1px solid #f8f8f8", background: i % 2 === 0 ? "white" : "#fafafa" }}>
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
                <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#bbb", margin: "14px 0 0" }}>
                  Prices are indicative averages based on recent transactions. Contact us for current market data.
                </p>
              </div>
            )}

            {/* 3. Lifestyle */}
            {(area.lifestyle_dining_text || area.lifestyle_parks_text || area.lifestyle_shopping_text) && (
              <div style={{ background: "white", borderRadius: 20, padding: "32px", boxShadow: "0 2px 16px rgba(25,37,55,0.05)" }}>
                <SectionHeading>Lifestyle</SectionHeading>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {[
                    { title: "Dining",            emoji: "🍽️", text: area.lifestyle_dining_text,   image: area.lifestyle_dining_image   },
                    { title: "Parks & Recreation", emoji: "🌿", text: area.lifestyle_parks_text,    image: area.lifestyle_parks_image    },
                    { title: "Shopping",           emoji: "🛍️", text: area.lifestyle_shopping_text, image: area.lifestyle_shopping_image },
                  ].filter(c => c.text).map(({ title, emoji, text }, idx, arr) => (
                    <div key={title} style={{ paddingBottom: idx < arr.length - 1 ? 24 : 0, marginBottom: idx < arr.length - 1 ? 24 : 0, borderBottom: idx < arr.length - 1 ? "1px solid #f4f6f9" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 18 }}>{emoji}</span>
                        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#192537" }}>{title}</span>
                      </div>
                      {(text as string).split(/\n\n+/).filter(Boolean).map((para: string, i: number) => (
                        <p key={i} style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#7a8a9e", lineHeight: 1.85, margin: i === 0 ? 0 : "12px 0 0" }}>{para.trim()}</p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Commute Times */}
            {commuteLines.length > 0 && (
              <div style={{ background: "white", borderRadius: 20, padding: "32px", boxShadow: "0 2px 16px rgba(25,37,55,0.05)" }}>
                <SectionHeading>Commute Times</SectionHeading>
                <div
                  className="commute-grid"
                  style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}
                >
                  {commuteLines.map((line: string) => {
                    // Parse "Destination — X min" or "Destination - X min"
                    const parts = line.split(/\s*[—–-]\s*/);
                    const dest = parts[0]?.trim() ?? line;
                    const time = parts.slice(1).join(" — ").trim() || null;
                    return (
                      <div
                        key={line}
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
                        <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#555" }}>
                          {dest}
                        </span>
                        {time && (
                          <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#192537", whiteSpace: "nowrap", marginLeft: 12 }}>
                            {time}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. Nearby Amenities */}
            {(schools.length > 0 || hospitals.length > 0 || malls.length > 0) && (
              <div style={{ background: "white", borderRadius: 20, padding: "32px", boxShadow: "0 2px 16px rgba(25,37,55,0.05)" }}>
                <SectionHeading>Nearby Amenities</SectionHeading>
                {amenitiesAreProse ? (
                  /* Prose layout — each category is a stacked row with paragraphs */
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {[
                      { title: "Schools & Education", icon: "🏫", items: schools },
                      { title: "Healthcare",          icon: "🏥", items: hospitals },
                      { title: "Shopping",            icon: "🛍️", items: malls },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ].filter(s => s.items.length > 0).map(({ title, icon, items }, idx, arr) => (
                      <div key={title} style={{ paddingBottom: idx < arr.length - 1 ? 24 : 0, marginBottom: idx < arr.length - 1 ? 24 : 0, borderBottom: idx < arr.length - 1 ? "1px solid #f4f6f9" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 18 }}>{icon}</span>
                          <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#192537" }}>{title}</span>
                        </div>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {items.map((s: any, i: number) => {
                          const text = typeof s === "string" ? s : (s.name as string) ?? "";
                          return (
                            <p key={i} style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#7a8a9e", lineHeight: 1.85, margin: i === 0 ? 0 : "12px 0 0" }}>
                              {text}
                            </p>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Chips layout — short names in a 3-col grid */
                  <div
                    className="amenities-cols"
                    style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}
                  >
                    {schools.length > 0 && (
                      <AmenityColumn
                        title="Schools"
                        icon="🏫"
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        items={schools.map((s: any) =>
                          typeof s === "string"
                            ? { name: s }
                            : { name: s.name as string, sub: [s.type, s.distance].filter(Boolean).join(" · ") || undefined }
                        )}
                      />
                    )}
                    {hospitals.length > 0 && (
                      <AmenityColumn
                        title="Healthcare"
                        icon="🏥"
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        items={hospitals.map((h: any) =>
                          typeof h === "string"
                            ? { name: h }
                            : { name: h.name as string, sub: (h.distance as string) || undefined }
                        )}
                      />
                    )}
                    {malls.length > 0 && (
                      <AmenityColumn
                        title="Shopping"
                        icon="🛍️"
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        items={malls.map((m: any) =>
                          typeof m === "string"
                            ? { name: m }
                            : { name: m.name as string, sub: (m.distance as string) || undefined }
                        )}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 6. Nearby Areas */}
            {nearbyAreas.length > 0 && (
              <div style={{ background: "white", borderRadius: 20, padding: "32px", boxShadow: "0 2px 16px rgba(25,37,55,0.05)" }}>
                <SectionHeading>Nearby Areas</SectionHeading>
                {nearbyAsChips ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {nearbyAreas.map((name: string) => {
                      const nearbySlug = publishedAreaLookup.get(name.toLowerCase().trim()) ?? null;
                      return nearbySlug ? (
                        <Link
                          key={name}
                          href={`/area-guides/${nearbySlug}`}
                          className="nearby-chip"
                          style={{ display: "inline-block", background: "rgba(25,37,55,0.04)", border: "1.5px solid rgba(25,37,55,0.1)", color: "#192537", fontFamily: "Verdana, sans-serif", fontSize: 12, padding: "8px 18px", borderRadius: 999, textDecoration: "none" }}
                        >
                          {name} →
                        </Link>
                      ) : (
                        <span
                          key={name}
                          style={{ display: "inline-block", background: "#f4f6f9", border: "1.5px solid #e8ecf0", color: "#c0c8d0", fontFamily: "Verdana, sans-serif", fontSize: 12, padding: "8px 18px", borderRadius: 999, cursor: "default" }}
                        >
                          {name}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {nearbyAreas.map((text: string, i: number) => (
                      <p key={i} style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", lineHeight: 1.85, margin: 0 }}>
                        {text}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 7. Location Map */}
            <PrimeLocationMap
              areaName={area.name}
              latitude={area.latitude ?? undefined}
              longitude={area.longitude ?? undefined}
            />

            {/* 7. Projects in this area */}
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
                            ? (
                              <div style={{ position: "relative" }}>
                                <img src={p.image} alt={p.name} style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
                                <span style={{ position: "absolute", top: 8, left: 8, background: bg, color: "white", fontFamily: "Verdana,sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999 }}>{p.status}</span>
                              </div>
                            )
                            : (
                              <div style={{ height: 110, background: "linear-gradient(135deg,#192537,#0d1e2e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, position: "relative" }}>
                                <span>🏙️</span>
                                <span style={{ position: "absolute", top: 8, left: 8, background: bg, color: "white", fontFamily: "Verdana,sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999 }}>{p.status}</span>
                              </div>
                            )
                          }
                          <div style={{ padding: "10px 12px 14px" }}>
                            <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 12, color: "#192537", lineHeight: 1.3, marginBottom: 5 }}>{p.name}</div>
                            {p.bedrooms && <div style={{ fontFamily: "Verdana,sans-serif", fontSize: 10, color: "#7a8a9e", marginBottom: 3 }}>{p.bedrooms}</div>}
                            {p.handover && <div style={{ fontFamily: "Verdana,sans-serif", fontSize: 10, color: "#7a8a9e", marginBottom: 3 }}>Handover {p.handover}</div>}
                            {p.priceFrom && <div style={{ fontFamily: "Verdana,sans-serif", fontSize: 10, color: "#7fe2e3", fontWeight: 700 }}>From AED {Number(p.priceFrom).toLocaleString()}</div>}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                <Link
                  href={`/projects?area=${encodeURIComponent(area.name)}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 20, fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 12, color: "#7fe2e3", textDecoration: "none" }}
                >
                  View all {area.name} projects →
                </Link>
              </div>
            )}

            {/* 8. FAQs */}
            {faqs.length > 0 && (
              <div style={{ background: "white", borderRadius: 20, padding: "32px", boxShadow: "0 2px 16px rgba(25,37,55,0.05)" }}>
                <SectionHeading>Frequently Asked Questions</SectionHeading>
                {faqs.map((f, i) => (
                  <FaqAccordion key={i} q={f.q} a={f.a} />
                ))}
              </div>
            )}


          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className="area-sidebar" style={{ position: "sticky", top: 88 }}>

            {/* Agent card */}
            {area.agent_name && (
              <div style={{ background: "white", borderRadius: 20, padding: "24px", boxShadow: "0 4px 28px rgba(25,37,55,0.09)", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                  {area.agent_photo ? (
                    <img
                      src={area.agent_photo}
                      alt={area.agent_name}
                      style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid #f0f0f0" }}
                    />
                  ) : (
                    <div
                      style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #192537 0%, #1a4a60 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    >
                      <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 20, color: "#7fe2e3" }}>
                        {(area.agent_name as string).charAt(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "#192537", marginBottom: 3 }}>{area.agent_name}</div>
                    <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e" }}>{area.name} Specialist</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {area.agent_phone && (
                    <a
                      href={`tel:${area.agent_phone}`}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px", borderRadius: 12, background: "#192537", color: "white", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, textDecoration: "none", boxSizing: "border-box" }}
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
            <div style={{ background: "white", borderRadius: 20, padding: "24px", boxShadow: "0 4px 28px rgba(25,37,55,0.09)" }}>
              <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "#192537", margin: "0 0 6px" }}>
                Enquire About {area.name}
              </h3>
              <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e", margin: "0 0 20px", lineHeight: 1.6 }}>
                Get prices, availability and expert advice — free of charge.
              </p>
              <LeadForm areaName={area.name} />
            </div>

          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div style={{ background: "white", borderTop: "1px solid #eee", padding: "20px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Link
            href="/area-guides"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#192537", textDecoration: "none" }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M9.5 3L5 7.5 9.5 12" stroke="#192537" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back to all area guides
          </Link>
        </div>
      </div>

      <style>{`
        .nearby-chip:hover { background: rgba(127,226,227,0.1) !important; border-color: #7fe2e3 !important; color: #0d5e5f !important; }
        .area-proj-card { transition: transform 0.2s, box-shadow 0.2s; }
        .area-proj-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(25,37,55,0.1); }
        .stats-strip { scrollbar-width: none; }
        .stats-strip::-webkit-scrollbar { display: none; }
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
      <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 20, color: "#192537", margin: 0, letterSpacing: "-0.01em" }}>
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
      <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: highlight ? "#0d5e5f" : "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>
        {label}
      </span>
      <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: highlight ? "#0d5e5f" : "#192537" }}>
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

function AmenityColumn({ title, icon, items }: { title: string; icon: string; items: { name: string; sub?: string }[] }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #f0f0f0" }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#192537" }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, i) => (
          <div key={i}>
            <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#333", marginBottom: 2, lineHeight: 1.4 }}>{item.name}</div>
            {item.sub && <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#aaa" }}>{item.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
