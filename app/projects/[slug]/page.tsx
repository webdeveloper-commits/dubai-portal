"use client";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Footer from "@/app/components/Footer";
import { Disclaimer, CookieBanner, FloatingContact } from "@/app/components/GlobalExtras";
import {
  MapPin, Bed, Calendar, ChevronLeft, ChevronRight,
  Phone, Mail, CheckCircle2, ChevronDown, Building2, Layers,
} from "lucide-react";
import dynamic from "next/dynamic";

const PrimeLocationMap = dynamic(() => import("@/app/components/PrimeLocationMap"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface FloorPlan { type: string; beds: number; sqft_min: number; sqft_max: number; price_from?: number }
interface FaqItem   { q: string; a: string }

interface ProjectData {
  id: string; name: string; tagline: string; developer: string; area: string;
  status: string; tag?: string; priceFrom: number; priceTo: number;
  handover: string; bedrooms: string; propertyTypes: string[];
  descriptionShort: string; descriptionLong: string;
  images: string[]; imagesExterior: string[]; imagesInterior: string[]; imagesAmenities: string[];
  paymentPlanSummary: string; paymentPlanDetail: Record<string, number> | null;
  floorPlans: FloorPlan[]; faqs: FaqItem[]; amenities: string[];
  latitude: number; longitude: number; totalUnits: number | null;
  developerSlug: string | null;
  areaSlug: string | null;
}

// ─── Supabase mapper ──────────────────────────────────────────────────────────

function statusToTag(s: string): string | undefined {
  if (s === "ready" || s === "completed") return "Ready";
  if (s === "new_launch") return "New Launch";
  if (s === "off_plan")   return "Off-Plan";
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): ProjectData {
  const q = r.handover_quarter ?? "";
  const yr = r.handover_year ?? "";
  const rawFaqs = r.aeo_faq ?? [];
  const faqs: FaqItem[] = rawFaqs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((f: any) => ({ q: f.question ?? f.q ?? "", a: f.answer ?? f.a ?? "" }))
    .filter((f: FaqItem) => f.q && f.a);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const floorPlans: FloorPlan[] = (r.floor_plans ?? []).map((f: any) => ({
    type: f.type ?? `${f.beds}BR`, beds: f.beds ?? 0,
    sqft_min: f.sqft_min ?? 0, sqft_max: f.sqft_max ?? 0, price_from: f.price_from,
  }));
  const allImgs = (r.images_all ?? []) as string[];
  const images  = allImgs.length > 0 ? allImgs : [r.image_main].filter(Boolean);
  return {
    id: r.id, name: r.name ?? "Project", tagline: r.tagline ?? "",
    developer: r.whatsapp_share_text ?? "", area: r.geo_summary ?? "Dubai, UAE",
    status: r.status ?? "off_plan", tag: statusToTag(r.status),
    priceFrom: r.price_from ?? 0, priceTo: r.price_to ?? 0,
    handover: [q, yr].filter(Boolean).join(" "),
    bedrooms: r.bedroom_min != null && r.bedroom_max != null
      ? `${r.bedroom_min}–${r.bedroom_max} BR` : "Contact us",
    propertyTypes: r.property_types ?? [],
    descriptionShort: r.description_short ?? "", descriptionLong: r.description_long ?? "",
    images, imagesExterior: (r.images_exterior ?? []) as string[],
    imagesInterior: (r.images_interior ?? []) as string[],
    imagesAmenities: (r.images_amenities ?? []) as string[],
    paymentPlanSummary: r.payment_plan_summary ?? "", paymentPlanDetail: r.payment_plan_detail ?? null,
    floorPlans, faqs, amenities: r.amenities ?? [],
    latitude: r.latitude ?? 25.2048, longitude: r.longitude ?? 55.2708,
    totalUnits: r.total_units ?? null,
    developerSlug: r.developer_slug ?? null,
    areaSlug: r.area_slug ?? null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return "AED " + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  return "AED " + n.toLocaleString();
}

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  "Off-Plan":   { bg: "rgba(25,37,55,0.85)", color: "#7fe2e3" },
  "Ready":      { bg: "#7fe2e3",             color: "#192537" },
  "New Launch": { bg: "#f97316",             color: "white"   },
};

// ─── Amenity icon mapping ─────────────────────────────────────────────────────

const AMENITY_ICONS: [string, string][] = [
  ["pool","🏊"],["swimming","🏊"],["gym","🏋"],["fitness","🏋"],["crossfit","🏋"],
  ["spa","💆"],["sauna","🧖"],["jacuzzi","🛁"],["tennis","🎾"],["squash","🎾"],
  ["kids","🧒"],["playground","🧒"],["children","🧒"],["garden","🌳"],["park","🌳"],
  ["parking","🚗"],["garage","🚗"],["valet","🚗"],["security","🛡"],["cctv","🛡"],
  ["concierge","🛎"],["retail","🛍"],["shop","🛍"],["restaurant","🍽"],["dining","🍽"],
  ["cafe","☕"],["beach","🏖"],["waterfront","🌊"],["marina","⛵"],["yoga","🧘"],
  ["bbq","🔥"],["barbecue","🔥"],["jogging","🏃"],["cycling","🚲"],["cinema","🎬"],
  ["library","📚"],["terrace","🌅"],["view","🌅"],["lounge","🛋"],["lobby","🏛"],
  ["basketball","🏀"],["volleyball","🏐"],["golf","⛳"],["paddle","🎾"],
];

function amenityIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [kw, icon] of AMENITY_ICONS) if (lower.includes(kw)) return icon;
  return "✦";
}

// ─── Tabbed Gallery ───────────────────────────────────────────────────────────

type GTab = "all" | "exterior" | "interior" | "amenities";

function Gallery({ images, exterior, interior, amenities }: {
  images: string[]; exterior: string[]; interior: string[]; amenities: string[];
}) {
  const tabs = [
    { key: "all"       as GTab, label: "All Photos",  imgs: images    },
    { key: "exterior"  as GTab, label: "Exterior",    imgs: exterior  },
    { key: "interior"  as GTab, label: "Interior",    imgs: interior  },
    { key: "amenities" as GTab, label: "Amenities",   imgs: amenities },
  ].filter(t => t.imgs.length > 0);

  const [tab, setTab] = useState<GTab>(tabs[0]?.key ?? "all");
  const [idx, setIdx] = useState(0);
  const imgs = tabs.find(t => t.key === tab)?.imgs ?? [];
  const changeTab = (k: GTab) => { setTab(k); setIdx(0); };
  const prev = () => setIdx(i => (i - 1 + imgs.length) % imgs.length);
  const next = () => setIdx(i => (i + 1) % imgs.length);

  return (
    <div>
      {tabs.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => changeTab(t.key)}
              style={{ padding: "8px 18px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.02em", background: tab === t.key ? "#192537" : "#f4f6f9", color: tab === t.key ? "white" : "#7a8a9e", transition: "all 0.2s" }}>
              {t.label} <span style={{ opacity: 0.5, fontWeight: 400 }}>({t.imgs.length})</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", aspectRatio: "16/9", background: "#0d1e2e" }}>
        {imgs[idx] && (
          <img key={`${tab}-${idx}`} src={imgs[idx]} alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", animation: "fadeIn 0.3s ease" }} />
        )}
        {imgs.length > 1 && (
          <>
            <button onClick={prev} style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: 14, width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft size={18} color="white" />
            </button>
            <button onClick={next} style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", right: 14, width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronRight size={18} color="white" />
            </button>
            <div style={{ position: "absolute", bottom: 14, right: 14, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", borderRadius: 999, padding: "5px 14px", fontFamily: "Verdana", fontSize: 11, color: "white" }}>
              {idx + 1} / {imgs.length}
            </div>
          </>
        )}
      </div>
      {imgs.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, overflowX: "auto", paddingBottom: 4 }}>
          {imgs.slice(0, 9).map((src, i) => (
            <button key={i} onClick={() => setIdx(i)}
              style={{ flexShrink: 0, width: 80, height: 54, borderRadius: 8, overflow: "hidden", border: i === idx ? "2.5px solid #7fe2e3" : "2.5px solid transparent", padding: 0, cursor: "pointer", transition: "border-color 0.2s" }}>
              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Payment Plan Visual ──────────────────────────────────────────────────────

function PaymentPlanVisual({ summary, detail }: { summary: string; detail: Record<string, number> | null }) {
  const COLORS = ["#7fe2e3", "#4db8b9", "#192537", "#7a8a9e"];
  let segs: { label: string; pct: number; color: string }[] = [];
  if (detail) {
    segs = Object.entries(detail).filter(([, p]) => p > 0).map(([label, pct], i) => ({ label, pct, color: COLORS[i] ?? "#ccc" }));
  } else if (summary) {
    const parts = summary.split("/").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const labels = ["On Booking", "During Construction", "On Handover", "Post Handover"];
    segs = parts.map((pct, i) => ({ pct, label: labels[i] ?? `Part ${i + 1}`, color: COLORS[i] ?? "#ccc" })).filter(s => s.pct > 0);
  }

  return (
    <div>
      {summary && <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", marginBottom: 22, lineHeight: 1.85 }}>{summary}</p>}
      {segs.length > 0 && (
        <>
          <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", marginBottom: 20, gap: 2 }}>
            {segs.map(s => <div key={s.label} style={{ flex: s.pct, background: s.color, borderRadius: 999 }} />)}
          </div>
          <div className="pp-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(segs.length, 4)}, 1fr)`, gap: 12 }}>
            {segs.map(s => (
              <div key={s.label} style={{ background: "#f8fafc", borderRadius: 14, padding: "16px 14px", borderLeft: `3px solid ${s.color}` }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: s.color, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 6 }}>{s.pct}%</div>
                <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7a8a9e", lineHeight: 1.4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── FAQ Accordion ────────────────────────────────────────────────────────────

function FaqAccordion({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid rgba(25,37,55,0.07)" }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "20px 0", textAlign: "left" }}>
        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, fontSize: 14, color: "#192537", lineHeight: 1.4, flex: 1 }}>{q}</span>
        <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: open ? "#7fe2e3" : "rgba(127,226,227,0.12)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}>
          <ChevronDown size={13} color="#192537" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.25s" }} />
        </span>
      </button>
      <div style={{ maxHeight: open ? 400 : 0, overflow: "hidden", transition: "max-height 0.3s ease" }}>
        <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", lineHeight: 1.85, paddingBottom: 20, paddingRight: 40, margin: 0 }}>{a}</p>
      </div>
    </div>
  );
}

// ─── Lead Form ────────────────────────────────────────────────────────────────

function LeadForm({ projectName }: { projectName: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [sent, setSent] = useState(false);
  if (sent) return (
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <CheckCircle2 size={40} color="#7fe2e3" style={{ marginBottom: 12 }} />
      <h4 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "#192537", marginBottom: 6 }}>Thank you!</h4>
      <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#7a8a9e", lineHeight: 1.7, margin: 0 }}>
        We&apos;ve received your enquiry about <strong>{projectName}</strong>. An advisor will contact you within the hour.
      </p>
    </div>
  );
  const inputSt: React.CSSProperties = { width: "100%", padding: "11px 13px", borderRadius: 10, border: "1.5px solid #eaeaea", fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#333", outline: "none", boxSizing: "border-box", background: "#fafafa" };
  return (
    <form onSubmit={e => { e.preventDefault(); setSent(true); }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {([{ k: "name", ph: "Your Name", type: "text" }, { k: "email", ph: "Email Address", type: "email" }, { k: "phone", ph: "Phone / WhatsApp", type: "tel" }] as { k: "name" | "email" | "phone"; ph: string; type: string }[]).map(({ k, ph, type }) => (
        <input key={k} type={type} placeholder={ph} required={k !== "phone"} value={form[k]}
          onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inputSt} />
      ))}
      <button type="submit" style={{ background: "linear-gradient(135deg,#7fe2e3,#4db8b9)", color: "#192537", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, padding: "13px", borderRadius: 12, border: "none", cursor: "pointer", marginTop: 2, letterSpacing: "0.02em" }}>
        Request Information
      </button>
      <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#bbb", textAlign: "center", margin: 0 }}>Free consultation · No obligation · Reply within 1 hour</p>
    </form>
  );
}

// ─── Section Heading ──────────────────────────────────────────────────────────

function SH({ label, title }: { label?: string; title: string }) {
  return (
    <div style={{ marginBottom: 26 }}>
      {label && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
          <div style={{ width: 18, height: 1.5, background: "#7fe2e3" }} />
          <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.28em", textTransform: "uppercase" }}>{label}</span>
        </div>
      )}
      <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 21, color: "#192537", margin: 0, letterSpacing: "-0.02em" }}>{title}</h2>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <main style={{ background: "#f4f6f9" }}>
      <div style={{ minHeight: "65vh", background: "linear-gradient(145deg,#0d1e2e,#192537)", display: "flex", alignItems: "flex-end", padding: "0 24px 56px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
          <div style={{ height: 12, width: 220, background: "rgba(255,255,255,0.08)", borderRadius: 6, marginBottom: 20 }} />
          <div style={{ height: 46, width: "52%", background: "rgba(255,255,255,0.07)", borderRadius: 8, marginBottom: 12 }} />
          <div style={{ height: 16, width: "24%", background: "rgba(255,255,255,0.05)", borderRadius: 6 }} />
        </div>
      </div>
    </main>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  useEffect(() => {
    supabase.from("projects").select("*").eq("slug", slug).single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true);
        else setProject(mapRow(data));
        setLoading(false);
      });
  }, [slug]);

  // Derive links directly from stored DB slugs — no runtime lookup needed
  const devSlug  = project?.developerSlug ?? null;
  const areaSlug = project?.areaSlug ?? null;

  if (loading) return <LoadingSkeleton />;
  if (notFound || !project) return (
    <main style={{ background: "#f9f9f9", minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 28, color: "#192537" }}>Project not found</h1>
      <Link href="/projects" style={{ fontFamily: "Verdana", fontSize: 13, color: "#7fe2e3" }}>← Back to all projects</Link>
    </main>
  );

  const tag = project.tag ? TAG_COLORS[project.tag] : null;
  const heroImg = project.images[0] ?? null;

  return (
    <main style={{ background: "#f4f6f9" }}>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", minHeight: "72vh", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
        {heroImg
          ? <img src={heroImg} alt={project.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
          : <div style={{ position: "absolute", inset: 0, background: "linear-gradient(145deg,#0d1e2e 0%,#192537 100%)" }} />
        }
        <div style={{ position: "absolute", inset: 0, background: heroImg ? "linear-gradient(to bottom, rgba(13,30,46,0.25) 0%, rgba(13,30,46,0.9) 100%)" : "transparent" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(127,226,227,0.05) 1px, transparent 1px)", backgroundSize: "36px 36px", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "120px 24px 56px", boxSizing: "border-box" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>

            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
              <Link href="/" style={{ fontFamily: "Verdana", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Home</Link>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
              <Link href="/projects" style={{ fontFamily: "Verdana", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Projects</Link>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
              <span style={{ fontFamily: "Verdana", fontSize: 11, color: "#7fe2e3" }}>{project.name}</span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {tag && project.tag && (
                  <span style={{ display: "inline-block", background: tag.bg, color: tag.color, fontFamily: "Verdana", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", padding: "6px 16px", borderRadius: 999, marginBottom: 16, border: "1px solid rgba(127,226,227,0.25)", backdropFilter: "blur(8px)" }}>
                    {project.tag}
                  </span>
                )}
                <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "clamp(28px,5vw,54px)", color: "white", margin: "0 0 12px", letterSpacing: "-0.03em", lineHeight: 1.05 }}>
                  {project.name}
                </h1>
                {project.tagline && (
                  <p style={{ fontFamily: "Verdana", fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 18px", fontStyle: "italic", lineHeight: 1.6 }}>
                    {project.tagline}
                  </p>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {project.developer && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ width: 18, height: 1, background: "#7fe2e3", opacity: 0.7 }} />
                      {devSlug
                        ? <Link href={`/developers/${devSlug}`} style={{ fontFamily: "Verdana", fontSize: 12, color: "#7fe2e3", textDecoration: "none" }}>by {project.developer} →</Link>
                        : <span style={{ fontFamily: "Verdana", fontSize: 12, color: "#7fe2e3" }}>by {project.developer}</span>
                      }
                    </div>
                  )}
                  {project.area && (
                    areaSlug
                      ? <Link href={`/area-guides/${areaSlug}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "Verdana", fontSize: 12, color: "rgba(255,255,255,0.65)", background: "rgba(255,255,255,0.08)", backdropFilter: "blur(6px)", padding: "5px 12px", borderRadius: 999, textDecoration: "none" }}>
                          <MapPin size={11} color="#7fe2e3" />{project.area} →
                        </Link>
                      : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "Verdana", fontSize: 12, color: "rgba(255,255,255,0.65)", background: "rgba(255,255,255,0.08)", backdropFilter: "blur(6px)", padding: "5px 12px", borderRadius: 999 }}>
                          <MapPin size={11} color="#7fe2e3" />{project.area}
                        </span>
                  )}
                  {project.handover && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "Verdana", fontSize: 12, color: "rgba(255,255,255,0.65)", background: "rgba(255,255,255,0.08)", backdropFilter: "blur(6px)", padding: "5px 12px", borderRadius: 999 }}>
                      <Calendar size={11} color="#7fe2e3" />Handover {project.handover}
                    </span>
                  )}
                </div>
              </div>

              {project.priceFrom > 0 && (
                <div style={{ background: "rgba(255,255,255,0.09)", backdropFilter: "blur(14px)", border: "1px solid rgba(127,226,227,0.2)", borderRadius: 20, padding: "20px 26px", textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Starting from</div>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "clamp(20px,3vw,32px)", color: "white", letterSpacing: "-0.03em" }}>
                    {fmt(project.priceFrom)}
                  </div>
                  {project.priceTo > 0 && (
                    <div style={{ fontFamily: "Verdana", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>up to {fmt(project.priceTo)}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── KEY FACTS STRIP ──────────────────────────────────────────────────── */}
      <div style={{ background: "#192537" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div className="facts-strip" style={{ display: "flex", overflowX: "auto" }}>
            {[
              { icon: <Bed size={14} color="#7fe2e3" />,      label: "Bedrooms",    val: project.bedrooms },
              { icon: <Calendar size={14} color="#7fe2e3" />, label: "Handover",    val: project.handover || "TBA" },
              { icon: <MapPin size={14} color="#7fe2e3" />,   label: "Location",    val: project.area },
              ...(project.totalUnits ? [{ icon: <Building2 size={14} color="#7fe2e3" />, label: "Total Units", val: String(project.totalUnits) }] : []),
              ...(project.paymentPlanSummary ? [{ icon: <Layers size={14} color="#7fe2e3" />, label: "Payment Plan", val: project.paymentPlanSummary }] : []),
            ].map(({ icon, label, val }, i, arr) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 24px", flexShrink: 0, borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(127,226,227,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
                <div>
                  <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "rgba(255,255,255,0.38)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "white", whiteSpace: "nowrap" }}>{val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px 96px", boxSizing: "border-box" }}>
        <div className="detail-layout" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 36, alignItems: "start" }}>

          {/* ── LEFT ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

            {/* Gallery */}
            {project.images.length > 0 && (
              <div style={{ background: "white", borderRadius: 24, padding: "28px", boxShadow: "0 2px 20px rgba(25,37,55,0.06)" }}>
                <SH label="Media" title="Gallery" />
                <Gallery images={project.images} exterior={project.imagesExterior} interior={project.imagesInterior} amenities={project.imagesAmenities} />
              </div>
            )}

            {/* Description */}
            {(project.descriptionLong || project.descriptionShort) && (
              <div style={{ background: "white", borderRadius: 24, padding: "28px", boxShadow: "0 2px 20px rgba(25,37,55,0.06)" }}>
                <SH label="Overview" title="About This Project" />
                <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", lineHeight: 1.95, margin: "0 0 20px" }}>
                  {project.descriptionLong || project.descriptionShort}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {project.propertyTypes.map(t => (
                    <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(127,226,227,0.08)", border: "1px solid rgba(127,226,227,0.2)", borderRadius: 999, padding: "6px 14px", fontFamily: "Verdana", fontSize: 11, color: "#0d5e5f" }}>
                      <Building2 size={10} color="#7fe2e3" />{t}
                    </span>
                  ))}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(127,226,227,0.08)", border: "1px solid rgba(127,226,227,0.2)", borderRadius: 999, padding: "6px 14px", fontFamily: "Verdana", fontSize: 11, color: "#0d5e5f" }}>
                    <Bed size={10} color="#7fe2e3" />{project.bedrooms}
                  </span>
                </div>
              </div>
            )}

            {/* Payment Plan */}
            {project.paymentPlanSummary && (
              <div style={{ background: "white", borderRadius: 24, padding: "28px", boxShadow: "0 2px 20px rgba(25,37,55,0.06)" }}>
                <SH label="Financing" title="Payment Plan" />
                <PaymentPlanVisual summary={project.paymentPlanSummary} detail={project.paymentPlanDetail} />
              </div>
            )}

            {/* Floor Plans */}
            {project.floorPlans.length > 0 && (
              <div style={{ background: "white", borderRadius: 24, padding: "28px", boxShadow: "0 2px 20px rgba(25,37,55,0.06)" }}>
                <SH label="Layouts" title="Floor Plans & Sizes" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 14 }}>
                  {project.floorPlans.map((fp, i) => (
                    <div key={i} style={{ background: "#f8fafc", borderRadius: 16, padding: "18px 16px", border: "1px solid #eef0f3", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: -12, right: -12, width: 60, height: 60, borderRadius: "50%", background: "rgba(127,226,227,0.06)" }} />
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(127,226,227,0.12)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                        <Layers size={15} color="#7fe2e3" />
                      </div>
                      <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "#192537", marginBottom: 4 }}>{fp.type}</div>
                      {fp.sqft_min > 0 && (
                        <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e", marginBottom: 10 }}>
                          {fp.sqft_min.toLocaleString()}{fp.sqft_max !== fp.sqft_min ? `–${fp.sqft_max.toLocaleString()}` : ""} sqft
                        </div>
                      )}
                      {fp.price_from && (
                        <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12, color: "#7fe2e3" }}>
                          from {fmt(fp.price_from)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Amenities */}
            {project.amenities.length > 0 && (
              <div style={{ background: "white", borderRadius: 24, padding: "28px", boxShadow: "0 2px 20px rgba(25,37,55,0.06)" }}>
                <SH label="Lifestyle" title="Amenities & Features" />
                <div className="amenities-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                  {project.amenities.map(a => (
                    <div key={a} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", background: "#f8fafc", borderRadius: 12, border: "1px solid #eef0f3" }}>
                      <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{amenityIcon(a)}</span>
                      <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#555", lineHeight: 1.3 }}>{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Map */}
            <div style={{ background: "white", borderRadius: 24, padding: "28px", boxShadow: "0 2px 20px rgba(25,37,55,0.06)" }}>
              <SH label="Where Is It" title="Location & Nearby" />
              <PrimeLocationMap areaName={project.area} latitude={project.latitude} longitude={project.longitude} />
            </div>

            {/* FAQs */}
            {project.faqs.length > 0 && (
              <div style={{ background: "white", borderRadius: 24, padding: "28px", boxShadow: "0 2px 20px rgba(25,37,55,0.06)" }}>
                <SH label="Questions" title="Frequently Asked Questions" />
                {project.faqs.map((f, i) => <FaqAccordion key={i} q={f.q} a={f.a} />)}
              </div>
            )}

          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className="detail-sidebar" style={{ position: "sticky", top: 100 }}>

            {/* Price + contacts */}
            <div style={{ background: "white", borderRadius: 24, padding: "24px", boxShadow: "0 4px 32px rgba(25,37,55,0.1)", marginBottom: 16, overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", top: -24, right: -24, width: 110, height: 110, borderRadius: "50%", background: "rgba(127,226,227,0.05)" }} />
              <div style={{ position: "absolute", bottom: 16, left: -20, width: 70, height: 70, borderRadius: "50%", background: "rgba(127,226,227,0.04)" }} />

              {project.priceFrom > 0 && (
                <div style={{ marginBottom: 20, position: "relative" }}>
                  <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#aaa", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Price range</div>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#192537", letterSpacing: "-0.03em" }}>
                    {fmt(project.priceFrom)}{project.priceTo > 0 ? ` – ${fmt(project.priceTo)}` : "+"}
                  </div>
                  <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#ccc", marginTop: 3 }}>All prices in AED · subject to availability</div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid #f4f4f4", paddingTop: 16, marginBottom: 20 }}>
                {/* Location — links to area guide if exists */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f8f8f8" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "Verdana", fontSize: 11, color: "#bbb" }}><MapPin size={12} color="#7fe2e3" />Location</div>
                  {areaSlug
                    ? <Link href={`/area-guides/${areaSlug}`} style={{ fontFamily: "Verdana", fontSize: 11, fontWeight: 600, color: "#7fe2e3", textDecoration: "none", textAlign: "right", maxWidth: 160 }}>{project.area} →</Link>
                    : <span style={{ fontFamily: "Verdana", fontSize: 11, fontWeight: 600, color: "#192537", textAlign: "right", maxWidth: 160 }}>{project.area}</span>
                  }
                </div>
                {/* Developer — links to developer page if exists */}
                {project.developer && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f8f8f8" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "Verdana", fontSize: 11, color: "#bbb" }}><Building2 size={12} color="#7fe2e3" />Developer</div>
                    {devSlug
                      ? <Link href={`/developers/${devSlug}`} style={{ fontFamily: "Verdana", fontSize: 11, fontWeight: 600, color: "#7fe2e3", textDecoration: "none", textAlign: "right", maxWidth: 160 }}>{project.developer} →</Link>
                      : <span style={{ fontFamily: "Verdana", fontSize: 11, fontWeight: 600, color: "#192537", textAlign: "right", maxWidth: 160 }}>{project.developer}</span>
                    }
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f8f8f8" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "Verdana", fontSize: 11, color: "#bbb" }}><Bed size={12} color="#7fe2e3" />Bedrooms</div>
                  <span style={{ fontFamily: "Verdana", fontSize: 11, fontWeight: 600, color: "#192537" }}>{project.bedrooms}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f8f8f8" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "Verdana", fontSize: 11, color: "#bbb" }}><Calendar size={12} color="#7fe2e3" />Handover</div>
                  <span style={{ fontFamily: "Verdana", fontSize: 11, fontWeight: 600, color: "#192537" }}>{project.handover || "TBA"}</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <a href="tel:+97140000000" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "13px", borderRadius: 12, background: "#192537", color: "white", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, textDecoration: "none", boxSizing: "border-box", letterSpacing: "0.02em" }}>
                  <Phone size={14} /> Call Now
                </a>
                <a href={`https://wa.me/97140000000?text=Hi, I'm interested in ${encodeURIComponent(project.name)}`} target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "13px", borderRadius: 12, background: "#25D366", color: "white", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, textDecoration: "none", boxSizing: "border-box" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.134.558 4.133 1.533 5.868L0 24l6.334-1.508A11.937 11.937 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.37l-.36-.213-3.732.888.936-3.617-.235-.372A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
                  </svg>
                  WhatsApp
                </a>
                <a href={`mailto:hello@elysian.ae?subject=Enquiry: ${project.name}`}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px", borderRadius: 12, background: "transparent", color: "#192537", border: "1.5px solid #e8e8e8", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, textDecoration: "none", boxSizing: "border-box" }}>
                  <Mail size={14} /> Email Us
                </a>
              </div>
            </div>

            {/* Lead form */}
            <div style={{ background: "white", borderRadius: 24, padding: "24px", boxShadow: "0 4px 32px rgba(25,37,55,0.1)" }}>
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.22em", textTransform: "uppercase", margin: "0 0 6px" }}>Free Consultation</p>
                <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 17, color: "#192537", margin: 0, lineHeight: 1.25 }}>Request More Information</h3>
              </div>
              <LeadForm projectName={project.name} />
            </div>

          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR ───────────────────────────────────────────────────────── */}
      <div style={{ background: "white", borderTop: "1px solid #eee", padding: "20px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <Link href="/projects" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#192537", textDecoration: "none" }}>
            <ChevronLeft size={14} /> Back to all projects
          </Link>
          {project.priceFrom > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#aaa" }}>Starting from</span>
              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 17, color: "#192537", letterSpacing: "-0.02em" }}>{fmt(project.priceFrom)}</span>
              <a href="tel:+97140000000" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#7fe2e3", color: "#192537", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 12, padding: "9px 20px", borderRadius: 999, textDecoration: "none" }}>
                <Phone size={12} /> Call Now
              </a>
            </div>
          )}
        </div>
      </div>

      <Footer />
      <Disclaimer />
      <CookieBanner />
      <FloatingContact />

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        .facts-strip { scrollbar-width: none; }
        .facts-strip::-webkit-scrollbar { display: none; }
        @media (max-width: 1024px) {
          .detail-layout  { grid-template-columns: 1fr !important; }
          .detail-sidebar { position: static !important; }
        }
        @media (max-width: 768px) {
          .amenities-grid { grid-template-columns: repeat(2,1fr) !important; }
          .pp-grid        { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 480px) {
          .amenities-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
