import { supabase } from "@/lib/supabase";
import SearchableAreaGrid from "./SearchableAreaGrid";

interface AreaSummary {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  hero_image: string | null;
  roi_pct: number | null;
  best_for: string | null;
}

const breadcrumbSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",        item: "https://elysian.ae" },
    { "@type": "ListItem", position: 2, name: "Area Guides", item: "https://elysian.ae/area-guides" },
  ],
});

export const revalidate = 3600;

export const metadata = {
  title: "Dubai Area Guides | Elysian Real Estate",
  description: "Explore our comprehensive guides to Dubai's most sought-after neighbourhoods — average prices, ROI, lifestyle, schools, and more.",
  alternates: { canonical: "https://elysian.ae/area-guides" },
};

export default async function AreaGuidesPage() {
  const { data } = await supabase
    .from("areas")
    .select("id,name,slug,tagline,hero_image,roi_pct,best_for,is_published")
    .eq("is_published", true)
    .order("name");

  const areas: AreaSummary[] = (data ?? []) as AreaSummary[];

  return (
    <main style={{ background: "#f4f6f9" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />

      {/* ── Hero ── */}
      <section
        style={{
          background: "linear-gradient(145deg, #0d1e2e 0%, #192537 100%)",
          paddingTop: 140,
          paddingBottom: 72,
          paddingLeft: 24,
          paddingRight: 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(circle, rgba(127,226,227,0.08) 1px, transparent 1px)",
            backgroundSize: "38px 38px",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            textAlign: "center",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <div style={{ width: 28, height: 1, background: "#7fe2e3", opacity: 0.5 }} />
            <span
              style={{
                fontFamily: "Verdana, sans-serif",
                fontSize: 10,
                color: "#7fe2e3",
                letterSpacing: "0.35em",
                textTransform: "uppercase",
              }}
            >
              Dubai Communities
            </span>
            <div style={{ width: 28, height: 1, background: "#7fe2e3", opacity: 0.5 }} />
          </div>
          <h1
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              fontSize: "clamp(32px, 5vw, 54px)",
              color: "white",
              lineHeight: 1.08,
              marginBottom: 20,
              letterSpacing: "-0.025em",
            }}
          >
            Dubai <span style={{ color: "#7fe2e3" }}>Area Guides</span>
          </h1>
          <p
            style={{
              fontFamily: "Verdana, sans-serif",
              fontSize: 13,
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.9,
              maxWidth: 540,
              margin: "0 auto",
            }}
          >
            In-depth neighbourhood profiles covering average prices, rental yields, lifestyle, schools, and everything you need to choose the right community in Dubai.
          </p>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div style={{ background: "#192537", padding: "24px" }}>
        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            display: "flex",
            justifyContent: "center",
            gap: 60,
            flexWrap: "wrap",
          }}
        >
          {[
            [String(areas.length > 0 ? areas.length + "+" : "20+"), "Neighbourhoods Covered"],
            ["8%+", "Average Rental Yield"],
            ["0%", "Property Tax"],
          ].map(([val, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontWeight: 800,
                  fontSize: 26,
                  color: "#7fe2e3",
                  letterSpacing: "-0.03em",
                }}
              >
                {val}
              </div>
              <div
                style={{
                  fontFamily: "Verdana, sans-serif",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  marginTop: 4,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      <section style={{ padding: "64px 24px 96px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          {areas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 22, color: "#192537", marginBottom: 10 }}>
                Area guides coming soon
              </p>
              <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e" }}>
                We are currently building our neighbourhood guides. Check back shortly.
              </p>
            </div>
          ) : (
            <SearchableAreaGrid areas={areas} />
          )}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: "#0d1e2e", padding: "72px 24px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <p
            style={{
              fontFamily: "Verdana, sans-serif",
              fontSize: 10,
              color: "#7fe2e3",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            Free Advice
          </p>
          <h2
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              fontSize: "clamp(26px, 4vw, 38px)",
              color: "white",
              marginBottom: 16,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            Not sure which area<br />is right for you?
          </h2>
          <p
            style={{
              fontFamily: "Verdana, sans-serif",
              fontSize: 13,
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.9,
              marginBottom: 36,
            }}
          >
            Our advisors know every community in Dubai and can match your budget and lifestyle to the perfect neighbourhood.
          </p>
          <a
            href="#"
            style={{
              display: "inline-block",
              background: "#7fe2e3",
              color: "#192537",
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              fontSize: 13,
              padding: "15px 36px",
              borderRadius: 999,
              textDecoration: "none",
              letterSpacing: "0.03em",
            }}
          >
            Speak to an Advisor
          </a>
        </div>
      </section>

    </main>
  );
}
