import { supabase } from "@/lib/supabase";
import BlogClientGrid from "./BlogClientGrid";

export const revalidate = 3600;

export const metadata = {
  title: "Dubai Property Expert Insights | Elysian Real Estate Blog",
  description: "Market analysis, area guides, investment tips, and everything you need to know about Dubai real estate.",
  alternates: { canonical: "https://elysian.ae/blog" },
};

export default async function BlogPage() {
  const { data } = await supabase
    .from("blog_posts")
    .select("id,title,slug,category,tags,read_time,cover_image,excerpt,author_name,featured,created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });

  const posts = (data ?? []) as {
    id: string; title: string; slug: string; category: string; tags: string[];
    read_time: number; cover_image: string; excerpt: string;
    author_name: string; featured: boolean; created_at: string;
  }[];

  return (
    <main>

      {/* Hero — server-rendered, Google sees this immediately */}
      <section style={{ background: "#0d1e2e", paddingTop: 140, paddingBottom: 72, paddingLeft: 24, paddingRight: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(127,226,227,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(ellipse 85% 85% at 50% 50%, black 30%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 85% 85% at 50% 50%, black 30%, transparent 100%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 2 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <div style={{ width: 28, height: 1, background: "#7fe2e3", opacity: 0.5 }} />
            <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.35em", textTransform: "uppercase" }}>Insights & Guides</span>
            <div style={{ width: 28, height: 1, background: "#7fe2e3", opacity: 0.5 }} />
          </div>
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(34px, 5.5vw, 56px)", color: "white", lineHeight: 1.08, marginBottom: 20, letterSpacing: "-0.025em" }}>
            Dubai Property<br /><span style={{ color: "#7fe2e3" }}>Expert Insights</span>
          </h1>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.9, maxWidth: 500, margin: "0 auto" }}>
            Market analysis, area guides, investment tips, and everything you need to know about Dubai real estate.
          </p>
        </div>
      </section>

      {/* Category tabs + featured post + grid — client component receives server data */}
      <BlogClientGrid posts={posts} />

      {/* CTA — server-rendered */}
      <section style={{ background: "#0d1e2e", padding: "72px 24px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 20 }}>FREE CONSULTATION</p>
          <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(24px, 4vw, 36px)", color: "white", marginBottom: 16, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            Ready to invest<br />in Dubai property?
          </h2>
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.9, marginBottom: 36 }}>
            Our advisors help investors find the right off-plan opportunity at the right price.
          </p>
          <a href="#" style={{ display: "inline-block", background: "#7fe2e3", color: "#192537", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, padding: "15px 36px", borderRadius: 999, textDecoration: "none" }}>
            Speak to an Advisor
          </a>
        </div>
      </section>

    </main>
  );
}
