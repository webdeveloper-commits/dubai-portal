import HeroSection from "@/app/components/HeroSection";
import FeaturedProjects from "@/app/components/FeaturedProjects";
import PropertyTypes from "@/app/components/PropertyTypes";
import LuxuryResidences from "@/app/components/LuxuryResidences";
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
    developer:     (r.developer as string) ?? "",
    area:          (r.geo_summary as string) ?? "Dubai, UAE",
    propertyTypes: (r.property_types as string[]) ?? [],
    priceFrom:     (r.price_from as number) ?? 0,
    handover:      [q, yr || ""].filter(Boolean).join(" "),
    bedrooms:      bMin != null && bMax != null ? `${bMin}–${bMax} BR` : "Contact us",
    image:         (r.image_main as string) ?? imgs[0] ?? "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=700&q=80",
    tag:           r.status === "new_launch" ? "New Launch" : r.status === "ready" ? "Ready" : r.status === "off_plan" ? "Off-Plan" : undefined,
    slug:          r.slug as string,
  };
}

export default async function Home() {
  const { data: rows } = await supabase
    .from("projects")
    .select("id,name,slug,status,price_from,handover_quarter,handover_year,bedroom_min,bedroom_max,property_types,lifestyle_tags,image_main,images_all,geo_summary,developer")
    .order("created_at", { ascending: false });

  const projects: Project[] = (rows ?? []).map(mapRow);

  return (
    <main>
      <HeroSection projects={projects} />
      <FeaturedProjects />
      <PropertyTypes />
      <LuxuryResidences />
      <PropertiesByArea />
      <PropertiesByLifestyle />
      <AboutElysian />
      <Footer />
      <Disclaimer />
      <CookieBanner />
      <FloatingContact />
    </main>
  );
}
