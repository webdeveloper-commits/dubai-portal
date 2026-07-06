import { supabase } from "@/lib/supabase";
import Footer from "@/app/components/Footer";
import { Disclaimer, CookieBanner, FloatingContact } from "@/app/components/GlobalExtras";
import ProjectsClientGrid from "./ProjectsClientGrid";

export const metadata = {
  title: "Off-Plan Projects & Properties in Dubai | Elysian Real Estate",
  description: "Browse every off-plan and ready property we represent across Dubai and the UAE. Filter by area, developer, price, and handover date.",
  alternates: { canonical: "https://elysian.ae/projects" },
};

function statusToTag(status: string): string | undefined {
  if (status === "ready" || status === "completed") return "Ready";
  if (status === "new_launch")                      return "New Launch";
  if (status === "off_plan")                        return "Off-Plan";
  return undefined;
}

function mapRow(r: Record<string, unknown>) {
  const q    = (r.handover_quarter as string) ?? "";
  const yr   = (r.handover_year   as number) ?? 0;
  const bMin = r.bedroom_min as number | null;
  const bMax = r.bedroom_max as number | null;
  const imgs = (r.images_all as string[]) ?? [];

  return {
    id:            r.id as string,
    name:          (r.name as string) ?? "Unnamed Project",
    developer:     (r.whatsapp_share_text as string) ?? "",
    area:          (r.geo_summary as string) ?? "Dubai, UAE",
    propertyTypes: (r.property_types as string[]) ?? [],
    priceFrom:     (r.price_from as number) ?? 0,
    handover:      [q, yr || ""].filter(Boolean).join(" "),
    handoverYear:  yr,
    bedrooms:      bMin != null && bMax != null ? `${bMin}–${bMax} BR` : "Contact us",
    image:         (r.image_main as string) ?? imgs[0] ?? "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=700&q=80",
    tag:           statusToTag(r.status as string),
    slug:          r.slug as string,
    lifestyle:     (r.lifestyle_tags as string[]) ?? [],
  };
}

export default async function ProjectsPage() {
  const { data } = await supabase
    .from("projects")
    .select("id,name,slug,status,price_from,handover_quarter,handover_year,bedroom_min,bedroom_max,property_types,lifestyle_tags,image_main,images_all,geo_summary,whatsapp_share_text")
    .order("created_at", { ascending: false });

  const projects = (data ?? []).map(mapRow);

  return (
    <main>

      {/* Hero — server-rendered, Google sees this immediately */}
      <section style={{ background: "#0d1e2e", paddingTop: 140, paddingBottom: 72, paddingLeft: 24, paddingRight: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle, rgba(127,226,227,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(ellipse 85% 85% at 50% 50%, black 30%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 85% 85% at 50% 50%, black 30%, transparent 100%)" }} />
        <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 400, background: "radial-gradient(ellipse, rgba(127,226,227,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 2 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <div style={{ width: 28, height: 1, background: "#7fe2e3", opacity: 0.5 }} />
            <span style={{ fontFamily: "Verdana", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.35em", textTransform: "uppercase" }}>Dubai & UAE</span>
            <div style={{ width: 28, height: 1, background: "#7fe2e3", opacity: 0.5 }} />
          </div>
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(34px, 5.5vw, 58px)", color: "white", lineHeight: 1.08, marginBottom: 20, letterSpacing: "-0.025em" }}>
            All Properties &<br /><span style={{ color: "#7fe2e3" }}>Off-Plan Projects</span>
          </h1>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.9, maxWidth: 520, margin: "0 auto" }}>
            Browse every off-plan and ready property we represent across Dubai and the UAE.
          </p>
        </div>
      </section>

      {/* Stats bar — server-rendered */}
      <div style={{ background: "#192537", padding: "24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", justifyContent: "center", gap: 60, flexWrap: "wrap" }}>
          {[["1,200+", "Properties Listed"], ["50+", "Trusted Developers"], ["15+", "Prime Communities"]].map(([val, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 26, color: "#7fe2e3", letterSpacing: "-0.03em" }}>{val}</div>
              <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter bar + grid — client component receives server data */}
      <ProjectsClientGrid projects={projects} />

      {/* CTA — server-rendered */}
      <section style={{ background: "#0d1e2e", padding: "72px 24px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 20 }}>FREE CONSULTATION</p>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(26px, 4vw, 38px)", color: "white", marginBottom: 16, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            Can&apos;t find what<br />you&apos;re looking for?
          </h2>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.9, marginBottom: 36 }}>
            Our advisors have access to exclusive off-market listings and pre-launch opportunities not yet on the portal.
          </p>
          <a href="#" style={{ display: "inline-block", background: "#7fe2e3", color: "#192537", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, padding: "15px 36px", borderRadius: 999, textDecoration: "none", letterSpacing: "0.03em" }}>
            Speak to an Advisor
          </a>
        </div>
      </section>

      <Footer />
      <Disclaimer />
      <CookieBanner />
      <FloatingContact />
    </main>
  );
}
