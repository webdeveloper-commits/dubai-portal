"use client";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  MapPin, Bed, Calendar, ChevronLeft, ChevronRight,
  CheckCircle2, ChevronDown, Building2, Layers, Ruler, Clock,
} from "lucide-react";
import dynamic from "next/dynamic";
import { isValidPhoneNumber } from "libphonenumber-js";
import PhoneField from "@/app/components/PhoneField";
import { getLeadTrackingData } from "@/lib/tracking";

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
  latitude: number | null; longitude: number | null; totalUnits: number | null;
  developerSlug: string | null;
  areaSlug: string | null;
  // New fields
  investmentPotential: string[];
  commuteTimes: string[];
  lifestyleTags: string[];
  freeholdZone: boolean;
  goldenVisaEligible: boolean;
  mortgageAvailable: boolean;
  dldWaiver: boolean;
  roiEstimate: number | null;
  rentalDemandRating: string | null;
  sizeSqftMin: number | null;
  sizeSqftMax: number | null;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
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

  // FAQs: try aeo_faq first, then faqs
  let faqs: FaqItem[] = [];
  const rawAeo = r.aeo_faq ?? [];
  const rawFaq = r.faqs ?? [];
  if (Array.isArray(rawAeo) && rawAeo.length > 0) {
    faqs = rawAeo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((f: any) => ({ q: f.question ?? f.q ?? "", a: f.answer ?? f.a ?? "" }))
      .filter((f: FaqItem) => f.q && f.a);
  }
  if (faqs.length === 0 && Array.isArray(rawFaq) && rawFaq.length > 0) {
    faqs = rawFaq
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((f: any) => ({ q: f.q ?? f.question ?? "", a: f.a ?? f.answer ?? "" }))
      .filter((f: FaqItem) => f.q && f.a);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const floorPlans: FloorPlan[] = (r.floor_plans ?? []).map((f: any) => ({
    type: f.type ?? `${f.beds}BR`, beds: f.beds ?? 0,
    sqft_min: f.sqft_min ?? 0, sqft_max: f.sqft_max ?? 0, price_from: f.price_from,
  }));
  const mainImg = (r.image_main as string) || null;
  // Skip images_all[0] — it's always the UK flag scraped from the phone-input widget
  const allImgs = ((r.images_all ?? []) as string[]).slice(1);
  const isPhoto = (url: string) => {
    if (!url) return false;
    const l = url.toLowerCase();
    if (/icon|check|tick|badge|verified|logo|svg|amenity[-_]?icon/i.test(l)) return false;
    return true;
  };
  // Always put image_main first (verified real thumbnail), then remaining images deduped
  const filteredAll = allImgs.filter(u => isPhoto(u) && u !== mainImg);
  const images = mainImg ? [mainImg, ...filteredAll] : filteredAll;

  return {
    id: r.id, name: r.name ?? "Project", tagline: r.tagline ?? "",
    developer: (() => {
      const wsLine = ((r.whatsapp_share_text as string) ?? "").split("\n")[0] ?? "";
      const byMatch = wsLine.match(/ by (.+)$/);
      return byMatch?.[1] ?? ((r.developer_slug as string ?? "").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()));
    })(),
    area: r.geo_summary ?? "Dubai, UAE",
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
    paymentPlanSummary: r.payment_plan_summary ?? "", paymentPlanDetail: (() => {
      const raw = r.payment_plan_detail;
      if (!raw) return null;
      if (Array.isArray(raw)) {
        const obj: Record<string, number> = {};
        for (const item of raw) {
          if (item.stage && item.percentage != null) obj[item.stage] = Number(item.percentage);
        }
        return Object.keys(obj).length > 0 ? obj : null;
      }
      return raw as Record<string, number>;
    })(),
    floorPlans, faqs, amenities: r.amenities ?? [],
    latitude: r.latitude ?? null, longitude: r.longitude ?? null,
    totalUnits: r.total_units ?? null,
    developerSlug: r.developer_slug ?? null,
    areaSlug: r.area_slug ?? null,
    // New fields
    investmentPotential: Array.isArray(r.investment_potential) ? r.investment_potential : [],
    commuteTimes: Array.isArray(r.commute_times) ? r.commute_times : [],
    lifestyleTags: Array.isArray(r.lifestyle_tags) ? r.lifestyle_tags : [],
    freeholdZone: r.freehold_zone === true,
    goldenVisaEligible: r.golden_visa_eligible === true,
    mortgageAvailable: r.mortgage_available === true,
    dldWaiver: r.dld_waiver === true,
    roiEstimate: r.roi_estimate ?? null,
    rentalDemandRating: r.rental_demand_rating ?? null,
    sizeSqftMin: r.size_sqft_min ?? null,
    sizeSqftMax: r.size_sqft_max ?? null,
    seoTitle: r.seo_title ?? "",
    seoDescription: r.seo_description ?? "",
    seoKeywords: Array.isArray(r.seo_keywords) ? r.seo_keywords : [],
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

// ─── Lifestyle tag emoji mapping ──────────────────────────────────────────────

const LIFESTYLE_EMOJIS: Record<string, string> = {
  golf: "⛳", family: "👨‍👩‍👧", luxury: "💎", beach: "🏖", marina: "⛵",
  community: "🏘", investment: "📈", waterfront: "🌊", "pet-friendly": "🐾",
  urban: "🏙", wellness: "🧘", sports: "🏃", quiet: "🌿", vibrant: "✨",
};

function lifestyleEmoji(tag: string): string {
  const lower = tag.toLowerCase();
  for (const [kw, em] of Object.entries(LIFESTYLE_EMOJIS)) {
    if (lower.includes(kw)) return em;
  }
  return "🌟";
}

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
  const [badImgs, setBadImgs] = useState<Set<string>>(new Set());
  const markBad = (src: string, w: number, h: number) => {
    if (w < 200 || h < 150) setBadImgs(prev => new Set(prev).add(src));
  };

  const clean = (arr: string[]) => arr.filter(u => !badImgs.has(u));

  const tabs = [
    { key: "all"       as GTab, label: "All Photos",  imgs: clean(images)    },
    { key: "exterior"  as GTab, label: "Exterior",    imgs: clean(exterior)  },
    { key: "interior"  as GTab, label: "Interior",    imgs: clean(interior)  },
    { key: "amenities" as GTab, label: "Amenities",   imgs: clean(amenities) },
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
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", animation: "fadeIn 0.3s ease" }}
            onLoad={e => { const el = e.currentTarget as HTMLImageElement; markBad(imgs[idx], el.naturalWidth, el.naturalHeight); }}
          />
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
        <div className="pd-thumbs" style={{ display: "flex", gap: 8, marginTop: 10, overflowX: "auto", paddingBottom: 4 }}>
          {imgs.slice(0, 9).map((src, i) => (
            <button key={i} onClick={() => setIdx(i)}
              style={{ flexShrink: 0, width: 80, height: 54, borderRadius: 8, overflow: "hidden", border: i === idx ? "2.5px solid #7fe2e3" : "2.5px solid transparent", padding: 0, cursor: "pointer", transition: "border-color 0.2s" }}>
              <img src={src} alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onLoad={e => { const el = e.currentTarget as HTMLImageElement; markBad(src, el.naturalWidth, el.naturalHeight); }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Payment Plan Visual ──────────────────────────────────────────────────────

function PaymentPlanVisual({ summary, detail, isMobile }: { summary: string; detail: Record<string, number> | null; isMobile?: boolean }) {
  const COLORS = ["#7fe2e3", "#4db8b9", "#192537", "#7a8a9e"];
  let segs: { label: string; pct: number; color: string }[] = [];
  if (detail) {
    segs = Object.entries(detail).filter(([, p]) => p > 0).map(([label, pct], i) => ({ label, pct, color: COLORS[i] ?? "#ccc" }));
  } else if (summary) {
    const parts = summary.split("/").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const labels = ["On Booking", "During Construction", "On Handover", "Post Handover"];
    segs = parts.map((pct, i) => ({ pct, label: labels[i] ?? `Part ${i + 1}`, color: COLORS[i] ?? "#ccc" })).filter(s => s.pct > 0);
  }
  const cols = Math.min(segs.length, 4);

  return (
    <div>
      {summary && <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", marginBottom: 22, lineHeight: 1.85 }}>{summary}</p>}
      {segs.length > 0 && (
        <>
          <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", marginBottom: 20, gap: 2 }}>
            {segs.map(s => <div key={s.label} style={{ flex: s.pct, background: s.color, borderRadius: 999 }} />)}
          </div>
          <div className="pp-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
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
        <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 14, color: "#4a5568", lineHeight: 1.85, paddingBottom: 20, paddingRight: 40, margin: 0 }}>{a}</p>
      </div>
    </div>
  );
}

// ─── Lead Form ────────────────────────────────────────────────────────────────

function LeadForm({ projectName, developerName, areaName }: { projectName: string; developerName?: string; areaName?: string }) {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [phone,   setPhone]   = useState("");
  const [message, setMessage] = useState("");
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())  e.name  = "Name is required.";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Valid email required.";
    if (!phone || !isValidPhoneNumber("+" + phone)) e.phone = "Please enter a valid phone number.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const tracking = getLeadTrackingData();
    try {
      const res = await fetch("/api/enquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), email: email.trim(), phone: "+" + phone,
          message: message.trim(),
          projectName, developerName: developerName || null, areaName: areaName || null,
          sourceUrl: typeof window !== "undefined" ? window.location.href : null,
          ...tracking,
        }),
      });
      const json = await res.json();
      if (!res.ok) setErrors({ submit: json.error || "Something went wrong." });
      else setSent(true);
    } catch {
      setErrors({ submit: "Connection error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  if (sent) return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <CheckCircle2 size={40} color="#7fe2e3" style={{ marginBottom: 10 }} />
      <h4 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 15, color: "#192537", marginBottom: 6 }}>Thank you!</h4>
      <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#7a8a9e", lineHeight: 1.7, margin: 0 }}>
        We&apos;ve received your enquiry about <strong>{projectName}</strong>. An advisor will contact you within the hour.
      </p>
    </div>
  );

  const inp: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #d8dce2", fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#333", outline: "none", boxSizing: "border-box", background: "#f7f8fa" };
  const errSt: React.CSSProperties = { fontFamily: "Verdana", fontSize: 10, color: "#e53e3e", marginTop: 3 };

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <input type="text" placeholder="Your Full Name *" value={name} onChange={e => setName(e.target.value)}
          style={{ ...inp, borderColor: errors.name ? "#e53e3e" : "#eaeaea" }} />
        {errors.name && <p style={errSt}>{errors.name}</p>}
      </div>
      <div>
        <input type="email" placeholder="Email Address *" value={email} onChange={e => setEmail(e.target.value)}
          style={{ ...inp, borderColor: errors.email ? "#e53e3e" : "#eaeaea" }} />
        {errors.email && <p style={errSt}>{errors.email}</p>}
      </div>
      <div>
        <PhoneField value={phone} onChange={setPhone} error={!!errors.phone} />
        {errors.phone && <p style={errSt}>{errors.phone}</p>}
      </div>
      <div>
        <textarea placeholder="Message (optional)" value={message} onChange={e => setMessage(e.target.value)}
          rows={3} style={{ ...inp, resize: "none", lineHeight: 1.6 }}
          onFocus={e => { e.currentTarget.style.borderColor = "#7fe2e3"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "#eaeaea"; }} />
      </div>
      {errors.submit && <p style={{ ...errSt, textAlign: "center" }}>{errors.submit}</p>}
      <button type="submit" disabled={loading}
        style={{ background: loading ? "#b2e8e8" : "linear-gradient(135deg,#7fe2e3,#4db8b9)", color: "#192537", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, padding: "13px", borderRadius: 12, border: "none", cursor: loading ? "default" : "pointer", marginTop: 2, letterSpacing: "0.02em" }}>
        {loading ? "Sending…" : "Request Information"}
      </button>
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
      <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 22, color: "#192537", margin: 0, letterSpacing: "-0.02em" }}>{title}</h2>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <main style={{ background: "#f4f6f9" }}>
      <div style={{ minHeight: "75vh", background: "linear-gradient(145deg,#0d1e2e,#192537)", display: "flex", alignItems: "flex-end", padding: "0 24px 56px" }}>
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

export default function ProjectDetailClient({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 1024);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);
  useEffect(() => {
    supabase
      .from("projects")
      .select("*")
      .eq("slug", slug)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true);
        else setProject(mapRow(data));
        setLoading(false);
      });
  }, [slug]);

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

  // Key badges
  const badges = [
    project.freeholdZone       ? { label: "Freehold",        icon: "✓" } : null,
    project.goldenVisaEligible ? { label: "Golden Visa",     icon: "✓" } : null,
    project.mortgageAvailable  ? { label: "Mortgage",        icon: "✓" } : null,
    project.dldWaiver          ? { label: "DLD Waiver",      icon: "✓" } : null,
  ].filter(Boolean) as { label: string; icon: string }[];

  // sqft range string
  const sqftRange = project.sizeSqftMin
    ? project.sizeSqftMax && project.sizeSqftMax !== project.sizeSqftMin
      ? `${project.sizeSqftMin.toLocaleString()}–${project.sizeSqftMax.toLocaleString()} sqft`
      : `${project.sizeSqftMin.toLocaleString()} sqft`
    : null;

  const cardPad = isMobile ? "20px 16px" : "28px";

  return (
    <main style={{ background: "#f4f6f9", overflowX: "hidden" }}>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="pd-hero" style={{ position: "relative", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
        {heroImg
          ? <img src={heroImg} alt={project.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
          : <div style={{ position: "absolute", inset: 0, background: "linear-gradient(145deg,#0d1e2e 0%,#192537 100%)" }} />
        }
        <div style={{ position: "absolute", inset: 0, background: heroImg ? "linear-gradient(to bottom, rgba(13,30,46,0.25) 0%, rgba(13,30,46,0.9) 100%)" : "transparent" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(127,226,227,0.05) 1px, transparent 1px)", backgroundSize: "36px 36px", pointerEvents: "none" }} />

        <div className="pd-hero-content" style={{ position: "relative", zIndex: 2, width: "100%", boxSizing: "border-box" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>

            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
              <Link href="/" style={{ fontFamily: "Verdana", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Home</Link>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
              <Link href="/projects" style={{ fontFamily: "Verdana", fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>Projects</Link>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
              <span style={{ fontFamily: "Verdana", fontSize: 11, color: "#7fe2e3" }}>{project.name}</span>
            </div>

            <div className="pd-hero-row">
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
                <div className="pd-price-box" style={{ background: "rgba(255,255,255,0.09)", backdropFilter: "blur(14px)", border: "1px solid rgba(127,226,227,0.2)", borderRadius: 20, flexShrink: 0 }}>
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
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="facts-strip">
            {[
              { icon: <Bed size={14} color="#7fe2e3" />,      label: "Bedrooms",     val: project.bedrooms },
              { icon: <Calendar size={14} color="#7fe2e3" />, label: "Handover",     val: project.handover || "TBA" },
              { icon: <MapPin size={14} color="#7fe2e3" />,   label: "Location",     val: project.area },
              ...(sqftRange ? [{ icon: <Ruler size={14} color="#7fe2e3" />, label: "Size", val: sqftRange }] : []),
              ...(project.totalUnits ? [{ icon: <Building2 size={14} color="#7fe2e3" />, label: "Total Units", val: String(project.totalUnits) }] : []),
              ...(project.paymentPlanSummary ? [{ icon: <Layers size={14} color="#7fe2e3" />, label: "Payment Plan", val: project.paymentPlanSummary }] : []),
            ].map(({ icon, label, val }, i, arr) => (
              <div key={label} className="facts-item" style={{
                borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(127,226,227,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "rgba(255,255,255,0.38)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "white" }}>{val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────────── */}
      <div className="pd-content">
        <div className="detail-layout">

          {/* ── LEFT ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32, minWidth: 0 }}>

            {/* Gallery */}
            {project.images.length > 0 && (
              <div className="pd-card">
                <SH label="Media" title="Gallery" />
                <Gallery images={project.images} exterior={project.imagesExterior} interior={project.imagesInterior} amenities={project.imagesAmenities} />
              </div>
            )}

            {/* Description + Lifestyle Tags */}
            {(project.descriptionLong || project.descriptionShort) && (
              <div className="pd-card">
                <SH label="Overview" title="About This Project" />
                <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 14, color: "#4a5568", lineHeight: 1.95, margin: "0 0 20px" }}>
                  {project.descriptionLong || project.descriptionShort}
                </p>
                {/* Property type chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: project.lifestyleTags.length > 0 ? 16 : 0 }}>
                  {project.propertyTypes.map(t => (
                    <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(127,226,227,0.08)", border: "1px solid rgba(127,226,227,0.2)", borderRadius: 999, padding: "6px 14px", fontFamily: "Verdana", fontSize: 11, color: "#0d5e5f" }}>
                      <Building2 size={10} color="#7fe2e3" />{t}
                    </span>
                  ))}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(127,226,227,0.08)", border: "1px solid rgba(127,226,227,0.2)", borderRadius: 999, padding: "6px 14px", fontFamily: "Verdana", fontSize: 11, color: "#0d5e5f" }}>
                    <Bed size={10} color="#7fe2e3" />{project.bedrooms}
                  </span>
                </div>
                {/* Lifestyle tags */}
                {project.lifestyleTags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {project.lifestyleTags.map((tag: string) => (
                      <span
                        key={tag}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f4f6f9", border: "1px solid rgba(25,37,55,0.08)", borderRadius: 999, padding: "6px 14px", fontFamily: "Verdana", fontSize: 11, color: "#192537" }}
                      >
                        <span style={{ fontSize: 13 }}>{lifestyleEmoji(tag)}</span>{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Investment Highlights */}
            {project.investmentPotential.length > 0 && (
              <div className="pd-card">
                <SH label="Returns" title="Investment Highlights" />
                <div className="investment-grid">
                  {project.investmentPotential.map((item: string, i: number) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 12,
                        padding: "16px 18px",
                        background: "#f8fafc",
                        borderRadius: 14,
                        border: "1px solid rgba(127,226,227,0.12)",
                      }}
                    >
                      <span style={{ color: "#7fe2e3", fontSize: 16, flexShrink: 0, marginTop: 1 }}>✦</span>
                      <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#444", lineHeight: 1.75, margin: 0 }}>{item}</p>
                    </div>
                  ))}
                </div>
                {(project.roiEstimate != null || project.rentalDemandRating) && (
                  <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                    {project.roiEstimate != null && (
                      <div style={{ background: "rgba(127,226,227,0.1)", border: "1px solid rgba(127,226,227,0.25)", borderRadius: 12, padding: "10px 18px" }}>
                        <div style={{ fontFamily: "Verdana", fontSize: 9, color: "#0d5e5f", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>Est. ROI</div>
                        <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 18, color: "#0d5e5f" }}>{project.roiEstimate}%</div>
                      </div>
                    )}
                    {project.rentalDemandRating && (
                      <div style={{ background: "rgba(127,226,227,0.1)", border: "1px solid rgba(127,226,227,0.25)", borderRadius: 12, padding: "10px 18px" }}>
                        <div style={{ fontFamily: "Verdana", fontSize: 9, color: "#0d5e5f", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>Rental Demand</div>
                        <div style={{ fontFamily: "Montserrat", fontWeight: 700, fontSize: 18, color: "#0d5e5f" }}>{project.rentalDemandRating}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Payment Plan */}
            {project.paymentPlanSummary && (
              <div className="pd-card">
                <SH label="Financing" title="Payment Plan" />
                <PaymentPlanVisual summary={project.paymentPlanSummary} detail={project.paymentPlanDetail} isMobile={isMobile} />
              </div>
            )}

            {/* Floor Plans */}
            {project.floorPlans.length > 0 && (
              <div className="pd-card">
                <SH label="Layouts" title="Floor Plans & Sizes" />
                {(() => {
                  const maxSqft = Math.max(...project.floorPlans.map(fp => fp.sqft_max || fp.sqft_min || 0));
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {project.floorPlans.map((fp, i) => {
                        const bedNum = fp.beds ?? parseInt(fp.type.replace(/\D/g, "")) ?? 0;
                        const sqftVal = fp.sqft_max || fp.sqft_min || 0;
                        const barPct  = maxSqft > 0 ? Math.round((sqftVal / maxSqft) * 100) : 0;
                        const bedLabel = fp.type === "Studio" ? "Studio" : bedNum === 1 ? "Bedroom" : "Bedrooms";
                        return isMobile ? (
                          /* ── Mobile: flat row ── */
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid #eef0f3" }}>
                            {/* bed badge */}
                            <div style={{ width: 46, height: 46, borderRadius: 13, background: "linear-gradient(150deg,#192537,#0d1929)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, gap: 1 }}>
                              <span style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 900, fontSize: 18, color: "#7fe2e3", lineHeight: 1 }}>{fp.type === "Studio" ? "S" : bedNum}</span>
                              <span style={{ fontFamily: "Verdana,sans-serif", fontSize: 7, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>BR</span>
                            </div>
                            {/* info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                <span style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 13, color: "#192537" }}>{fp.type}</span>
                                {fp.sqft_min > 0 && (
                                  <span style={{ fontFamily: "Verdana,sans-serif", fontSize: 11, color: "#7a8a9e" }}>
                                    {fp.sqft_min.toLocaleString()}{fp.sqft_max && fp.sqft_max !== fp.sqft_min ? `–${fp.sqft_max.toLocaleString()}` : ""} sqft
                                  </span>
                                )}
                              </div>
                              <div style={{ height: 3, background: "#f0f2f5", borderRadius: 999, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${barPct}%`, background: "linear-gradient(to right,#7fe2e3,#4db8b9)", borderRadius: 999 }} />
                              </div>
                            </div>
                            {/* price */}
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              {fp.price_from ? (
                                <>
                                  <div style={{ fontFamily: "Verdana,sans-serif", fontSize: 8, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>From</div>
                                  <div style={{ fontFamily: "Montserrat,sans-serif", fontWeight: 700, fontSize: 12, color: "#7fe2e3" }}>{fmt(fp.price_from)}</div>
                                </>
                              ) : (
                                <div style={{ fontFamily: "Verdana,sans-serif", fontSize: 10, color: "#aaa", fontStyle: "italic" }}>On request</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* ── Desktop: 3-panel card ── */
                          <div key={i} className="fp-row">
                            <div className="fp-left">
                              <span className="fp-left-num">{fp.type === "Studio" ? "S" : bedNum}</span>
                              <span className="fp-left-label">{bedLabel}</span>
                            </div>
                            <div className="fp-center">
                              <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(127,226,227,0.1)", border: "1px solid rgba(127,226,227,0.2)", borderRadius: 999, padding: "4px 12px", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#0d5e5f" }}>
                                  <Bed size={10} color="#0d5e5f" /> {fp.type}
                                </span>
                                {fp.beds != null && (
                                  <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e" }}>· {fp.beds} Bed{fp.beds !== 1 ? "s" : ""}</span>
                                )}
                              </div>
                              {fp.sqft_min > 0 && (
                                <div style={{ marginBottom: 10 }}>
                                  <span className="fp-sqft">{fp.sqft_min.toLocaleString()}{fp.sqft_max && fp.sqft_max !== fp.sqft_min ? `–${fp.sqft_max.toLocaleString()}` : ""}</span>
                                  <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#aab2be", marginLeft: 6 }}>sqft</span>
                                </div>
                              )}
                              <div style={{ height: 4, background: "#f0f2f5", borderRadius: 999, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${barPct}%`, background: "linear-gradient(to right, #7fe2e3, #4db8b9)", borderRadius: 999, transition: "width 0.6s ease" }} />
                              </div>
                            </div>
                            <div className="fp-right">
                              {fp.price_from ? (
                                <>
                                  <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "#c0c8d4", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>From</div>
                                  <div className="fp-price">{fmt(fp.price_from)}</div>
                                </>
                              ) : (
                                <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#c8cdd5", fontStyle: "italic", textAlign: "right" }}>Price on<br />request</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                {/* summary strip */}
                <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 22, padding: "11px 16px", background: "#f4f7fb", borderRadius: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <Layers size={12} color="#7fe2e3" />
                    <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e" }}>{project.floorPlans.length} unit type{project.floorPlans.length !== 1 ? "s" : ""} available</span>
                  </div>
                  {sqftRange && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <Ruler size={12} color="#7fe2e3" />
                      <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e" }}>Size range {sqftRange}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Amenities */}
            {project.amenities.length > 0 && (
              <div className="pd-card">
                <SH label="Lifestyle" title="Amenities & Features" />
                <div className="amenities-grid">
                  {project.amenities.map(a => (
                    <div key={a} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 13px", background: "#f8fafc", borderRadius: 12, border: "1px solid #eef0f3" }}>
                      <span style={{ fontSize: 17, lineHeight: 1, flexShrink: 0 }}>{amenityIcon(a)}</span>
                      <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#444", lineHeight: 1.35 }}>{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Commute Times */}
            {project.commuteTimes.length > 0 && (
              <div className="pd-card">
                <SH label="Connectivity" title="Commute Times" />
                {/* header strip */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, background: "linear-gradient(135deg, #192537 0%, #0d1e2e 100%)", borderRadius: 16, padding: "16px 20px", marginBottom: 20 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(127,226,227,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🚗</div>
                  <div>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "white", marginBottom: 3 }}>Well Connected Location</div>
                    <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "rgba(255,255,255,0.42)" }}>Approximate driving times from this development</div>
                  </div>
                </div>
                <div className="commute-grid">
                  {project.commuteTimes.map((line: string, i: number) => {
                    const parts = line.split(/\s*[—–-]\s*/);
                    const dest = parts[0]?.trim() ?? line;
                    const time = parts.slice(1).join(" — ").trim() || null;
                    const lower = dest.toLowerCase();
                    const icon = lower.includes("airport") || lower.includes("dxb") || lower.includes("dwc") ? "✈️"
                      : lower.includes("metro") ? "🚇"
                      : lower.includes("mall") || lower.includes("market") ? "🛍️"
                      : lower.includes("beach") ? "🏖️"
                      : lower.includes("marina") ? "⛵"
                      : lower.includes("hospital") || lower.includes("clinic") ? "🏥"
                      : lower.includes("school") || lower.includes("university") ? "🎓"
                      : lower.includes("park") && !lower.includes("parking") ? "🌳"
                      : lower.includes("burj") || lower.includes("tower") ? "🏙️"
                      : lower.includes("golf") ? "⛳"
                      : "📍";
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#f8fafc", borderRadius: 14, padding: "13px 16px", border: "1px solid rgba(25,37,55,0.04)" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 11, background: "white", border: "1px solid rgba(127,226,227,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, boxShadow: "0 2px 8px rgba(25,37,55,0.05)" }}>
                          {icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#444", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "normal" : "nowrap" }}>{dest}</div>
                          {time && (
                            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                              <Clock size={10} color="#7fe2e3" />
                              <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#7fe2e3" }}>{time}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Map */}
            <div className="pd-card">
              <SH label="Where Is It" title="Location & Nearby" />
              <PrimeLocationMap areaName={project.area} latitude={project.latitude ?? undefined} longitude={project.longitude ?? undefined} />
            </div>

            {/* FAQs */}
            {project.faqs.length > 0 && (
              <div className="pd-card">
                <SH label="Questions" title="Frequently Asked Questions" />
                {project.faqs.map((f, i) => <FaqAccordion key={i} q={f.q} a={f.a} />)}
              </div>
            )}

          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className="detail-sidebar">

            {/* Price + key info */}
            <div className="pd-sidebar-card" style={{ marginBottom: 16, overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", top: -24, right: -24, width: 110, height: 110, borderRadius: "50%", background: "rgba(127,226,227,0.05)" }} />
              <div style={{ position: "absolute", bottom: 16, left: -20, width: 70, height: 70, borderRadius: "50%", background: "rgba(127,226,227,0.04)" }} />

              {project.priceFrom > 0 && (
                <div style={{ marginBottom: 16, position: "relative" }}>
                  <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#aaa", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Price range</div>
                  <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 24, color: "#192537", letterSpacing: "-0.03em" }}>
                    {fmt(project.priceFrom)}{project.priceTo > 0 ? ` – ${fmt(project.priceTo)}` : "+"}
                  </div>
                  <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#ccc", marginTop: 3 }}>All prices in AED · subject to availability</div>
                </div>
              )}

              {/* Key badges */}
              {badges.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #f4f4f4" }}>
                  {badges.map(b => (
                    <span
                      key={b.label}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(127,226,227,0.1)", border: "1px solid rgba(127,226,227,0.3)", borderRadius: 999, padding: "5px 12px", fontFamily: "Verdana", fontSize: 10, color: "#0d5e5f", fontWeight: 700 }}
                    >
                      <span style={{ color: "#7fe2e3", fontWeight: 900 }}>{b.icon}</span> {b.label}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", borderTop: badges.length === 0 ? "1px solid #f4f4f4" : "none", paddingTop: badges.length === 0 ? 16 : 0, marginBottom: 20 }}>
                {/* Location */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f8f8f8" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "Verdana", fontSize: 11, color: "#bbb" }}><MapPin size={12} color="#7fe2e3" />Location</div>
                  {areaSlug
                    ? <Link href={`/area-guides/${areaSlug}`} style={{ fontFamily: "Verdana", fontSize: 11, fontWeight: 600, color: "#7fe2e3", textDecoration: "none", textAlign: "right", maxWidth: 160 }}>{project.area} →</Link>
                    : <span style={{ fontFamily: "Verdana", fontSize: 11, fontWeight: 600, color: "#192537", textAlign: "right", maxWidth: 160 }}>{project.area}</span>
                  }
                </div>
                {/* Developer */}
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
                {sqftRange && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f8f8f8" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "Verdana", fontSize: 11, color: "#bbb" }}><Ruler size={12} color="#7fe2e3" />Size</div>
                    <span style={{ fontFamily: "Verdana", fontSize: 11, fontWeight: 600, color: "#192537" }}>{sqftRange}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Lead form */}
            <div className="pd-sidebar-card">
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.22em", textTransform: "uppercase", margin: "0 0 6px" }}>Free Consultation</p>
                <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 17, color: "#192537", margin: 0, lineHeight: 1.25 }}>Request More Information</h3>
              </div>
              <LeadForm
                projectName={project.name}
                developerName={project.developer || undefined}
                areaName={project.area || undefined}
              />
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
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        .facts-strip { scrollbar-width: none; -webkit-overflow-scrolling: touch; }
        .facts-strip::-webkit-scrollbar { display: none; }
      `}</style>
    </main>
  );
}
