import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, MapPin, TrendingUp } from "lucide-react";
import ProjectsSection from "./ProjectsSection";
import EnquireDevButton from "./EnquireDevButton";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabase
    .from("developers")
    .select("name,seo_title,seo_description,seo_keywords,logo_url,aeo_snippet")
    .eq("slug", slug)
    .eq("published", true)
    .single();
  if (!data) return { title: "Developer | Elysian Dubai" };
  const title = (data.seo_title || `${data.name} Dubai Properties | Off-Plan Projects 2026`) as string;
  const desc  = (data.seo_description || data.aeo_snippet || "") as string;
  return {
    title,
    description: desc,
    keywords: (data.seo_keywords as string) || undefined,
    openGraph: {
      title, description: desc, type: "website", siteName: "Elysian Dubai",
      images: data.logo_url ? [{ url: data.logo_url as string }] : [],
    },
    twitter: { card: "summary", title, description: desc },
    alternates: { canonical: `https://elysian.ae/developers/${slug}` },
  };
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  "Completed": { bg: "rgba(34,197,94,0.1)",   color: "#16a34a" },
  "Ongoing":   { bg: "rgba(251,191,36,0.12)",  color: "#b45309" },
  "Off-Plan":  { bg: "rgba(127,226,227,0.12)", color: "#0f7a7b" },
};

export default async function DeveloperPage({ params }: Props) {
  const { slug } = await params;

  const { data: dev } = await supabase
    .from("developers")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!dev) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = dev as any;
  const strengths:    string[]                                           = d.strengths    || [];
  const keyProjects:  { name: string; location: string; type: string; status: string }[] = d.key_projects  || [];
  const faqs:         { q: string; a: string }[]                        = d.faqs         || [];
  const areas:        string[]                                           = d.areas        || [];
  const propTypes:    string[]                                           = d.property_types || [];

  // Decode common HTML entities from scraped content
  function decodeEntities(text: string): string {
    return text
      .replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"').replace(/&ldquo;/g, '"')
      .replace(/&amp;/g, '&').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
      .replace(/&nbsp;/g, ' ').replace(/&#160;/g, ' ')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&hellip;/g, '…');
  }

  // Split into paragraphs, decode entities, filter out all-caps press release headers, limit to 4 paras
  const allParas = (d.about || "").split(/\n\n+/).filter(Boolean).map(decodeEntities);
  const aboutParas = allParas.slice(0, 4);

  // Single query for all published areas; match developer's area names locally
  const { data: publishedAreasData } = await supabase
    .from("areas")
    .select("name, slug")
    .eq("is_published", true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const publishedAreaLookup = new Map<string, string>(
    (publishedAreasData ?? []).map((a: any) => [
      (a.name as string).toLowerCase().trim(),
      a.slug as string,
    ])
  );

  const areaSlugMap: Record<string, string> = {};
  for (const areaName of areas) {
    const slug = publishedAreaLookup.get(areaName.toLowerCase().trim()) ?? null;
    if (slug) areaSlugMap[areaName] = slug;
  }

  // Investment chart data — built from keyProjects status distribution
  const statusCounts: Record<string, number> = {};
  keyProjects.forEach(p => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1; });
  const totalKP = keyProjects.length;
  const yearsActive = d.founded_year ? (2026 - Number(d.founded_year)) : null;

  // Fetch linked projects using developer_slug (exact match, most reliable)
  const { data: rawLinkedProjects } = await supabase
    .from("projects")
    .select("name,slug,image_main,status,price_from")
    .eq("developer_slug", slug)
    .eq("is_published", true)
    .limit(9);

  function statusLabel(s: string): string {
    if (s === "ready" || s === "completed") return "Ready";
    if (s === "new_launch") return "New Launch";
    if (s === "off_plan")   return "Off-Plan";
    return s ?? "Off-Plan";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkedProjects = (rawLinkedProjects ?? []).map((p: any) => ({
    ...p,
    status: statusLabel(p.status),
  }));

  // JSON-LD — Organization
  const orgSchema = JSON.stringify({
    "@context": "https://schema.org", "@type": "Organization",
    name:        d.name,
    url:         d.website ? `https://${d.website.replace(/^https?:\/\//, "")}` : undefined,
    logo:        d.logo_url,
    description: d.aeo_snippet || aboutParas[0] || "",
    address:     { "@type": "PostalAddress", addressLocality: d.headquarters || "Dubai", addressCountry: "AE" },
    foundingDate: d.founded_year ? String(d.founded_year) : undefined,
    sameAs:      d.website ? [`https://${d.website.replace(/^https?:\/\//, "")}`] : [],
  });

  const breadcrumbSchema = JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home",       item: "https://elysian.ae" },
      { "@type": "ListItem", position: 2, name: "Developers", item: "https://elysian.ae/developers" },
      { "@type": "ListItem", position: 3, name: d.name,       item: `https://elysian.ae/developers/${slug}` },
    ],
  });

  const faqSchema = faqs.length > 0 ? JSON.stringify({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map(f => ({
      "@type": "Question", name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }) : null;

  return (
    <main style={{ background: "#f4f6f9" }}>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: orgSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqSchema }} />}

      {/* ── HERO ── */}
      <section style={{ background: "linear-gradient(145deg, #0d1e2e 0%, #192537 100%)", paddingTop: 120, paddingBottom: 64, paddingLeft: 24, paddingRight: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(127,226,227,0.08) 1px, transparent 1px)", backgroundSize: "38px 38px", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 2 }}>

          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 32, flexWrap: "wrap" }}>
            <Link href="/" style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Home</Link>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
            <Link href="/developers" style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Developers</Link>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
            <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7fe2e3" }}>{d.name}</span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 40, flexWrap: "wrap" }}>

            {/* Name + logo + tagline */}
            <div>
              {d.logo_url && (
                <div style={{ marginBottom: 20, background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "12px 20px", display: "inline-block" }}>
                  <img src={d.logo_url} alt={d.name} style={{ height: 44, maxWidth: 180, objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
                </div>
              )}
              <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 12, opacity: 0.8 }}>Developer Profile</div>
              <h1 style={{ fontFamily: "var(--font-montserrat), Montserrat, sans-serif", fontWeight: 900, fontSize: "clamp(28px, 4.5vw, 52px)", color: "white", marginBottom: 10, letterSpacing: "-0.025em", lineHeight: 1.1 }}>
                {d.name}
              </h1>
              {d.tagline && (
                <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", letterSpacing: "0.04em" }}>{d.tagline}</p>
              )}
              {d.headquarters && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14, fontFamily: "Verdana, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                  <MapPin size={12} color="#7fe2e3" />{d.headquarters}
                </div>
              )}
            </div>

            {/* Stats chips */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[
                d.founded_year && ["Est.", String(d.founded_year)],
                d.total_units  && ["Units", d.total_units],
                d.employees    && ["Team", d.employees],
              ].filter(Boolean).map(([label, val]) => (
                <div key={label as string} style={{ textAlign: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(127,226,227,0.12)", borderRadius: 14, padding: "16px 22px", minWidth: 80 }}>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 22, color: "#7fe2e3", letterSpacing: "-0.02em" }}>{val as string}</div>
                  <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4, letterSpacing: "0.06em" }}>{label as string}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── BODY ── */}
      <section style={{ padding: "64px 24px 96px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="dev-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 36, alignItems: "start" }}>

            {/* ── LEFT ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

              {/* About */}
              {aboutParas.length > 0 && (
                <div style={{ background: "white", borderRadius: 20, padding: "36px", boxShadow: "0 2px 16px rgba(25,37,55,0.05)", border: "1px solid rgba(25,37,55,0.05)" }}>
                  <h2 style={{ fontFamily: "var(--font-montserrat), Montserrat, sans-serif", fontWeight: 700, fontSize: 20, color: "#192537", marginBottom: 22, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 4, height: 20, background: "#7fe2e3", borderRadius: 2, flexShrink: 0, display: "inline-block" }} />
                    About {d.name}
                  </h2>
                  {aboutParas.map((para: string, i: number) => (
                    <p key={i} style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", lineHeight: 1.9, marginBottom: i < aboutParas.length - 1 ? 16 : 0 }}>
                      {para}
                    </p>
                  ))}
                </div>
              )}

              {/* ── INVESTMENT HIGHLIGHTS ── */}
              <div style={{ background: "linear-gradient(145deg, #0d1e2e 0%, #192537 100%)", borderRadius: 20, padding: "36px", boxShadow: "0 8px 32px rgba(13,30,46,0.25)", border: "1px solid rgba(127,226,227,0.08)", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(127,226,227,0.05) 1px, transparent 1px)", backgroundSize: "30px 30px", pointerEvents: "none" }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <h2 style={{ fontFamily: "var(--font-montserrat), Montserrat, sans-serif", fontWeight: 700, fontSize: 20, color: "white", marginBottom: 28, display: "flex", alignItems: "center", gap: 10 }}>
                    <TrendingUp size={20} color="#7fe2e3" style={{ flexShrink: 0 }} />
                    Investment Highlights
                  </h2>

                  {/* KPI row */}
                  <div className="inv-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 36 }}>
                    {[
                      yearsActive && { label: "Years Active", value: `${yearsActive}+` },
                      d.total_units && { label: "Units Delivered", value: d.total_units },
                      areas.length  && { label: "Areas Covered", value: String(areas.length) },
                      propTypes.length && { label: "Property Types", value: String(propTypes.length) },
                    ].filter(Boolean).map((item: any) => (
                      <div key={item.label} style={{ textAlign: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(127,226,227,0.1)", borderRadius: 14, padding: "18px 12px" }}>
                        <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#7fe2e3", letterSpacing: "-0.03em", lineHeight: 1 }}>{item.value}</div>
                        <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 6, letterSpacing: "0.05em" }}>{item.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Portfolio breakdown chart */}
                  {totalKP > 0 && (
                    <div style={{ marginBottom: 28 }}>
                      <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Portfolio Breakdown</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {(["Off-Plan", "Ongoing", "Completed"] as const).map(st => {
                          const count = statusCounts[st] || 0;
                          if (!count) return null;
                          const pct = Math.round((count / totalKP) * 100);
                          const clr = st === "Completed" ? "#10b981" : st === "Ongoing" ? "#f59e0b" : "#7fe2e3";
                          return (
                            <div key={st}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{st}</span>
                                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: clr }}>{pct}% · {count} project{count !== 1 ? "s" : ""}</span>
                              </div>
                              <div style={{ height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: clr, borderRadius: 999, transition: "width 0.6s ease" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Property type bars */}
                  {propTypes.length > 0 && (
                    <div>
                      <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Property Mix</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {propTypes.map((pt: string, idx: number) => {
                          const barW = Math.max(30, 100 - idx * (60 / Math.max(propTypes.length - 1, 1)));
                          return (
                            <div key={pt} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.55)", width: 110, flexShrink: 0 }}>{pt}</span>
                              <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${barW}%`, background: "linear-gradient(90deg, #7fe2e3, rgba(127,226,227,0.3))", borderRadius: 999 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Price range */}
                  {d.price_range && (
                    <div style={{ marginTop: 28, padding: "16px 20px", background: "rgba(127,226,227,0.07)", border: "1px solid rgba(127,226,227,0.14)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                      <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Typical Price Range</span>
                      <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#7fe2e3" }}>{d.price_range}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Key Projects */}
              {keyProjects.length > 0 && (
                <div style={{ background: "white", borderRadius: 20, padding: "36px", boxShadow: "0 2px 16px rgba(25,37,55,0.05)", border: "1px solid rgba(25,37,55,0.05)" }}>
                  <h2 style={{ fontFamily: "var(--font-montserrat), Montserrat, sans-serif", fontWeight: 700, fontSize: 20, color: "#192537", marginBottom: 22, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 4, height: 20, background: "#7fe2e3", borderRadius: 2, flexShrink: 0, display: "inline-block" }} />
                    Landmark Projects
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {keyProjects.map((p, i) => {
                      const ss = STATUS_STYLE[p.status] || STATUS_STYLE["Off-Plan"];
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 18px", background: "#f7f9fb", borderRadius: 12, border: "1px solid #eef0f3", flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#192537", marginBottom: 3 }}>{p.name}</div>
                            <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e" }}>{p.location}{p.type ? ` · ${p.type}` : ""}</div>
                          </div>
                          <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, letterSpacing: "0.06em", padding: "4px 12px", borderRadius: 999, background: ss.bg, color: ss.color, whiteSpace: "nowrap" }}>
                            {p.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Portal projects with filter (client component) */}
              {linkedProjects && linkedProjects.length > 0 && (
                <ProjectsSection projects={linkedProjects as any[]} devName={d.name} />
              )}

              {/* FAQs */}
              {faqs.length > 0 && (
                <div style={{ background: "white", borderRadius: 20, padding: "36px", boxShadow: "0 2px 16px rgba(25,37,55,0.05)", border: "1px solid rgba(25,37,55,0.05)" }}>
                  <h2 style={{ fontFamily: "var(--font-montserrat), Montserrat, sans-serif", fontWeight: 700, fontSize: 20, color: "#192537", marginBottom: 22, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 4, height: 20, background: "#7fe2e3", borderRadius: 2, flexShrink: 0, display: "inline-block" }} />
                    Frequently Asked Questions
                  </h2>
                  {faqs.map((f, i) => (
                    <details key={i} style={{ borderBottom: "1px solid #f0f4f8" }}>
                      <summary style={{ padding: "16px 0", fontFamily: "var(--font-montserrat), Montserrat, sans-serif", fontWeight: 600, fontSize: 15, color: "#192537", cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, userSelect: "none" }}>
                        {f.q}
                        <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: "#f0f4f8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#192537" }}>+</span>
                      </summary>
                      <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", lineHeight: 1.9, padding: "4px 0 18px", margin: 0 }}>{f.a}</p>
                    </details>
                  ))}
                </div>
              )}

              {/* Back */}
              <div>
                <Link href="/developers" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#192537", textDecoration: "none", padding: "12px 22px", borderRadius: 999, background: "white", border: "1px solid #e8ecf0" }}>
                  <ArrowLeft size={14} /> All Developers
                </Link>
              </div>
            </div>

            {/* ── RIGHT SIDEBAR ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 100 }} className="dev-sidebar">

              {/* Why invest */}
              {strengths.length > 0 && (
                <div style={{ background: "linear-gradient(145deg, #192537 0%, #0d1e2e 100%)", borderRadius: 20, padding: "28px 24px", boxShadow: "0 8px 32px rgba(25,37,55,0.2)" }}>
                  <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "white", marginBottom: 20 }}>
                    Why Invest with {d.name.split(" ")[0]}?
                  </h3>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                    {strengths.map((s: string, i: number) => (
                      <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontFamily: "Verdana, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.65 }}>
                        <span style={{ color: "#7fe2e3", flexShrink: 0, marginTop: 1 }}>✓</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Company info */}
              <div style={{ background: "white", borderRadius: 20, padding: "24px", boxShadow: "0 4px 20px rgba(25,37,55,0.06)", border: "1px solid rgba(25,37,55,0.05)" }}>
                <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#aab0ba", marginBottom: 16, letterSpacing: "0.08em", textTransform: "uppercase" }}>Company Details</h3>
                {[
                  d.headquarters && ["Headquarters", d.headquarters],
                  d.founded_year && ["Founded", String(d.founded_year)],
                  d.rera_number  && ["RERA No.", d.rera_number],
                  d.price_range  && ["Price Range", d.price_range],
                  d.website      && ["Website", d.website],
                ].filter(Boolean).map(([label, val]) => (
                  <div key={label as string} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f4f8" }}>
                    <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#aaa" }}>{label as string}</span>
                    {label === "Website"
                      ? <a href={`https://${(val as string).replace(/^https?:\/\//, "")}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7fe2e3", textDecoration: "none" }}>{val as string}</a>
                      : <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#192537", textAlign: "right" }}>{val as string}</span>
                    }
                  </div>
                ))}

                {/* Areas — linked to area guide pages using DB-resolved slugs */}
                {areas.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Key Areas</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {areas.map((a: string) => {
                        const resolvedSlug = areaSlugMap[a] ?? areaSlugMap[a.toLowerCase()];
                        return resolvedSlug ? (
                          <Link key={a} href={`/area-guides/${resolvedSlug}`} style={{ display: "inline-block", background: "rgba(127,226,227,0.08)", border: "1px solid rgba(127,226,227,0.2)", borderRadius: 999, padding: "3px 10px", fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3", textDecoration: "none" }}>
                            {a} →
                          </Link>
                        ) : (
                          <span key={a} style={{ display: "inline-block", background: "rgba(127,226,227,0.08)", border: "1px solid rgba(127,226,227,0.2)", borderRadius: 999, padding: "3px 10px", fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7a8a9e" }}>{a}</span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Property types */}
                {propTypes.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Property Types</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {propTypes.map(t => (
                        <span key={t} style={{ display: "inline-block", background: "#f4f7fa", border: "1px solid #e8ecf0", borderRadius: 999, padding: "3px 10px", fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7a8a9e" }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* CTA */}
              <div style={{ background: "rgba(127,226,227,0.07)", border: "1px solid rgba(127,226,227,0.2)", borderRadius: 20, padding: "24px", textAlign: "center" }}>
                <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#192537", lineHeight: 1.8, marginBottom: 18 }}>
                  Interested in {d.name.split(" ")[0]} projects? Our advisors can match you with the right opportunity.
                </p>
                <EnquireDevButton developerName={d.name} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 1024px) {
          .dev-grid    { grid-template-columns: 1fr !important; }
          .dev-sidebar { position: static !important; }
        }
        @media (max-width: 640px) {
          .proj-micro-grid { grid-template-columns: 1fr !important; }
          .inv-stats       { grid-template-columns: repeat(2,1fr) !important; }
        }
        details summary::-webkit-details-marker { display: none; }
      `}</style>
    </main>
  );
}
