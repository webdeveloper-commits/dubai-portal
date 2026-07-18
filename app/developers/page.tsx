import Link from "next/link";
import { supabase } from "@/lib/supabase";
import SearchableDevGrid from "./SearchableDevGrid";

export const revalidate = 3600;

export const metadata = {
  title: "Top Property Developers in Dubai | Elysian Real Estate",
  description: "Explore projects from the most trusted names in Dubai real estate — from iconic landmarks to master-planned communities.",
  alternates: { canonical: "https://elysian.ae/developers" },
};

export default async function DevelopersPage() {
  const { data } = await supabase
    .from("developers")
    .select("id,name,slug,tagline,logo_url,founded_year,headquarters,total_units,areas,property_types,price_range")
    .eq("published", true)
    .order("name", { ascending: true });

  const devs = (data ?? []) as {
    id: string; name: string; slug: string; tagline: string;
    logo_url: string; founded_year: number; headquarters: string;
    total_units: string; areas: string[]; property_types: string[]; price_range: string;
  }[];

  const totalUnits = devs.reduce((sum, d) => {
    const n = parseInt((d.total_units || "0").replace(/[^0-9]/g, ""));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  return (
    <main>

      {/* Hero — server-rendered, Google sees this immediately */}
      <section style={{ background: "#0d1e2e", paddingTop: 140, paddingBottom: 80, paddingLeft: 24, paddingRight: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle, rgba(127,226,227,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)" }} />
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 2 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <div style={{ width: 24, height: 1, background: "#7fe2e3", opacity: 0.5 }} />
            <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.35em", textTransform: "uppercase" }}>Dubai&apos;s Finest</span>
            <div style={{ width: 24, height: 1, background: "#7fe2e3", opacity: 0.5 }} />
          </div>
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(32px, 5vw, 52px)", color: "white", lineHeight: 1.1, marginBottom: 20, letterSpacing: "-0.025em" }}>
            Top Property<br /><span style={{ color: "#7fe2e3" }}>Developers in Dubai</span>
          </h1>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.9, maxWidth: 520, margin: "0 auto" }}>
            Explore projects from the most trusted names in Dubai real estate — from iconic landmarks to master-planned communities.
          </p>
        </div>
      </section>

      {/* Stats bar — server-rendered */}
      {devs.length > 0 && (
        <div style={{ background: "#192537", padding: "28px 24px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "center", gap: 60, flexWrap: "wrap" }}>
            {[
              [String(devs.length), "Featured Developers"],
              [totalUnits > 0 ? (totalUnits / 1000).toFixed(0) + "K+" : "300K+", "Total Units Delivered"],
              ["UAE & Beyond", "Operating Regions"],
            ].map(([val, label]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: 28, color: "#7fe2e3", letterSpacing: "-0.03em" }}>{val}</div>
                <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4, letterSpacing: "0.04em" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid — client component receives server data */}
      <section style={{ background: "#f4f6f9", padding: "72px 24px 96px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {devs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 20, color: "#192537" }}>No developers published yet</p>
              <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", marginTop: 10 }}>Add developers in the admin dashboard to see them here.</p>
            </div>
          ) : (
            <SearchableDevGrid devs={devs} />
          )}
        </div>
      </section>

      {/* CTA — server-rendered */}
      <section style={{ background: "#0d1e2e", padding: "72px 24px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 20 }}>FREE CONSULTATION</p>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(24px, 4vw, 36px)", color: "white", marginBottom: 16, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            Not sure which developer<br />is right for you?
          </h2>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.9, marginBottom: 36 }}>
            Our advisors compare every developer&apos;s track record, payment plans, and project quality — for free.
          </p>
          <Link href="/contact" style={{ display: "inline-block", background: "#7fe2e3", color: "#192537", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, padding: "15px 36px", borderRadius: 999, textDecoration: "none" }}>
            Speak to an Advisor
          </Link>
        </div>
      </section>

    </main>
  );
}
