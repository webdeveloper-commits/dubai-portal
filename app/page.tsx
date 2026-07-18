import HeroSection from "@/app/components/HeroSection";
import FeaturedProjects, { FeaturedProject } from "@/app/components/FeaturedProjects";
import FeaturedProjectPopup from "@/app/components/FeaturedProjectPopup";
import PropertyTypes from "@/app/components/PropertyTypes";
import LuxuryResidences from "@/app/components/LuxuryResidences";
import DeveloperLogos from "@/app/components/DeveloperLogos";
import PropertiesByArea from "@/app/components/PropertiesByArea";
import PropertiesByLifestyle from "@/app/components/PropertiesByLifestyle";
import AboutElysian from "@/app/components/AboutElysian";
import Footer from "@/app/components/Footer";
import { Disclaimer, CookieBanner, FloatingContact } from "@/app/components/GlobalExtras";
import { supabase } from "@/lib/supabase";
import type { Project } from "@/app/components/ProjectResults";

function mapRow(r: Record<string, unknown>): Project {
  const q    = (r.handover_quarter as string) ?? "";
  const yr   = (r.handover_year   as number) ?? 0;
  const bMin = r.bedroom_min as number | null;
  const bMax = r.bedroom_max as number | null;
  const imgs = (r.images_all as string[]) ?? [];
  return {
    id:            r.id as string,
    name:          (r.name as string) ?? "Unnamed Project",
    developer:     ((r.developer_slug as string) ?? "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    area:          (r.geo_summary as string) ?? "Dubai, UAE",
    propertyTypes: Array.isArray(r.property_types) ? (r.property_types as string[]) : [],
    priceFrom:     (r.price_from as number) ?? 0,
    handover:      [q, yr || ""].filter(Boolean).join(" "),
    handoverYear:  yr,
    bedrooms:      bMin != null && bMax != null ? `${bMin}–${bMax} BR` : "Contact us",
    image:         (r.image_main as string) ?? imgs[0] ?? "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=700&q=80",
    tag:           r.status === "new_launch" ? "New Launch" : r.status === "ready" ? "Ready" : r.status === "off_plan" ? "Off-Plan" : undefined,
    slug:          r.slug as string,
    lifestyle:     Array.isArray(r.lifestyle_tags) ? (r.lifestyle_tags as string[]) : [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFeatured(r: any): FeaturedProject {
  const q  = r.handover_quarter ?? "";
  const yr = r.handover_year ?? "";
  const imgs = (r.images_all as string[]) ?? [];
  const status = r.status as string;
  const tag = status === "new_launch" ? "New Launch" : status === "ready" ? "Ready" : "Off-Plan";
  return {
    id:          r.id,
    name:        r.name ?? "Unnamed Project",
    slug:        r.slug,
    developer:   ((r.developer_slug ?? "") as string).replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
    area:        r.geo_summary ?? "Dubai, UAE",
    tag,
    priceFrom:   r.price_from ?? 0,
    handover:    [q, yr || ""].filter(Boolean).join(" "),
    image:       r.image_main ?? imgs[0] ?? "",
    paymentPlan: r.payment_plan_summary ?? undefined,
  };
}

export const revalidate = 3600;

export default async function Home() {
  // All published projects for hero filter
  const { data: rows } = await supabase
    .from("projects")
    .select("id,name,slug,status,price_from,handover_quarter,handover_year,bedroom_min,bedroom_max,property_types,lifestyle_tags,image_main,images_all,geo_summary,developer_slug,is_published")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  const projects: Project[] = (rows ?? []).map(mapRow);

  // Featured projects for the carousel (is_featured first, then newest — up to 4)
  const { data: featuredRows } = await supabase
    .from("projects")
    .select("id,name,slug,status,price_from,handover_quarter,handover_year,image_main,images_all,geo_summary,developer_slug,payment_plan_summary,is_featured,is_published")
    .eq("is_published", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(4);

  const featuredProjects: FeaturedProject[] = (featuredRows ?? []).map(mapFeatured);

  // Single popup project — the one explicitly marked is_featured
  const popupProject = (featuredRows ?? []).find((r: Record<string, unknown>) => r.is_featured) ?? null;

  // Developer logos for partner strip
  const { data: devRows } = await supabase
    .from("developers")
    .select("name,slug,logo_url")
    .eq("published", true)
    .order("name", { ascending: true });

  const developerLogos = (devRows ?? []) as { name: string; slug: string; logo_url: string | null }[];

  // ── Area counts — match project.area against known area keywords ───────────
  const AREA_KW: Record<string, string[]> = {
    "downtown":     ["downtown"],
    "marina":       ["dubai marina", " marina"],
    "palm":         ["palm jumeirah"],
    "business-bay": ["business bay"],
    "jvc":          ["jumeirah village circle", "jvc"],
    "meydan":       ["meydan"],
    "creek":        ["creek harbour", "creek harbor"],
    "hills":        ["damac hills"],
    "jbr":          ["jumeirah beach residence", "jbr"],
    "dso":          ["silicon oasis"],
    "bluewaters":   ["bluewaters"],
    "sobha":        ["sobha hartland"],
  };
  const areaCounts: Record<string, number> = {};
  for (const p of projects) {
    const al = p.area.toLowerCase();
    for (const [id, kws] of Object.entries(AREA_KW)) {
      if (kws.some(kw => al.includes(kw))) areaCounts[id] = (areaCounts[id] ?? 0) + 1;
    }
  }

  // ── Lifestyle counts — match project.lifestyle_tags ───────────────────────
  const LIFESTYLE_KW: Record<string, string[]> = {
    "waterfront": ["waterfront", "canal", "creek"],
    "golf":       ["golf"],
    "luxury":     ["luxury", "premium", "ultra"],
    "branded":    ["branded"],
    "beachfront": ["beachfront", "beach"],
    "community":  ["community", "family", "gated"],
  };
  const lifestyleCounts: Record<string, number> = {};
  for (const p of projects) {
    for (const [id, kws] of Object.entries(LIFESTYLE_KW)) {
      if ((p.lifestyle ?? []).some((l: string) => kws.some(kw => l.toLowerCase().includes(kw)))) {
        lifestyleCounts[id] = (lifestyleCounts[id] ?? 0) + 1;
      }
    }
  }
  const popup = popupProject ? {
    name:       popupProject.name   ?? "Project",
    slug:       popupProject.slug   ?? "",
    price_from: popupProject.price_from ?? null,
    image_main: popupProject.image_main ?? null,
    area:       popupProject.geo_summary ?? "Dubai, UAE",
    developer:  ((popupProject.developer_slug ?? "") as string).replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
  } : null;

  return (
    <main>
      <HeroSection projects={projects} />
      <FeaturedProjects projects={featuredProjects} />
      <PropertyTypes />
      <DeveloperLogos developers={developerLogos} />
      <LuxuryResidences projects={projects} />
      <PropertiesByArea counts={areaCounts} />
      <PropertiesByLifestyle counts={lifestyleCounts} />
      <AboutElysian />
      <Footer />
      <Disclaimer />
      <CookieBanner />
      <FloatingContact />
      <FeaturedProjectPopup project={popup} />
    </main>
  );
}
