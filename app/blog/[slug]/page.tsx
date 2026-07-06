import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Footer from "@/app/components/Footer";
import { Disclaimer, CookieBanner, FloatingContact } from "@/app/components/GlobalExtras";
import { Calendar, Clock, ArrowUpRight, ArrowLeft, Tag, Phone } from "lucide-react";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabase
    .from("blog_posts")
    .select("title,excerpt,cover_image,seo_title,seo_description,seo_keywords")
    .eq("slug", slug)
    .eq("published", true)
    .single();
  if (!data) return { title: "Blog | Elysian Dubai" };
  const title = (data.seo_title || data.title) as string;
  const desc  = (data.seo_description || data.excerpt || "") as string;
  const img   = data.cover_image as string | null;
  return {
    title,
    description: desc,
    keywords: (data.seo_keywords as string) || undefined,
    openGraph: {
      title, description: desc, type: "article", siteName: "Elysian Dubai",
      images: img ? [{ url: img, width: 1200, height: 630, alt: title }] : [],
    },
    twitter: {
      card: "summary_large_image", title, description: desc,
      images: img ? [img] : [],
    },
    alternates: { canonical: `https://elysian.ae/blog/${slug}` },
  };
}

const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  "Market News":        { bg: "#f97316", text: "white" },
  "Area Guides":        { bg: "#10b981", text: "white" },
  "Investment Tips":    { bg: "#7fe2e3", text: "#192537" },
  "Developer Profiles": { bg: "#6366f1", text: "white" },
  "Project Updates":    { bg: "#192537", text: "white" },
};

function fmtDate(s: string) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;

  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!post) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = post as any;
  const faqs:    { q: string; a: string }[] = p.faqs    || [];
  const tags:    string[]                   = p.tags    || [];
  const related: string[]                   = p.related_project_slugs || [];
  const cat     = CAT_COLORS[p.category as string];

  const blogSchema = JSON.stringify({
    "@context": "https://schema.org", "@type": "BlogPosting",
    headline: p.title, description: p.excerpt || p.seo_description,
    image: p.cover_image,
    author: { "@type": "Person", name: p.author_name || "Elysian Advisory Team" },
    publisher: { "@type": "Organization", name: "Elysian",
      logo: { "@type": "ImageObject", url: "https://elysian.ae/logo.png" } },
    datePublished: p.created_at, dateModified: p.updated_at || p.created_at,
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://elysian.ae/blog/${slug}` },
    keywords: p.seo_keywords,
  });

  const breadcrumbSchema = JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home",  item: "https://elysian.ae" },
      { "@type": "ListItem", position: 2, name: "Blog",  item: "https://elysian.ae/blog" },
      { "@type": "ListItem", position: 3, name: p.title, item: `https://elysian.ae/blog/${slug}` },
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
    <main style={{ background: "#f4f6f9", minHeight: "100vh" }}>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: blogSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqSchema }} />}

      {/* ── HERO — full-width cover image with overlay ── */}
      <div style={{ position: "relative", minHeight: 560, maxHeight: 700, height: "68vh", overflow: "hidden", background: "#0d1e2e" }}>

        {/* Dot pattern (shows when no image) */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(127,226,227,0.07) 1px, transparent 1px)", backgroundSize: "38px 38px", zIndex: 1, pointerEvents: "none" }} />

        {/* Cover image */}
        {p.cover_image && (
          <img src={p.cover_image} alt={p.title}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", zIndex: 0 }} />
        )}

        {/* Gradient overlay — dark at top (for nav) and heavy at bottom (for text) */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(13,30,46,0.55) 0%, rgba(13,30,46,0.35) 35%, rgba(13,30,46,0.75) 65%, rgba(13,30,46,0.95) 100%)", zIndex: 2 }} />

        {/* Text anchored to bottom */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 3, padding: "0 24px 52px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>

            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 22, flexWrap: "wrap" }}>
              <Link href="/" style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>Home</Link>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>/</span>
              <Link href="/blog" style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>Blog</Link>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>/</span>
              <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7fe2e3" }}>{p.category || "Article"}</span>
            </div>

            {/* Category badge */}
            {cat && (
              <span style={{ display: "inline-block", background: cat.bg, color: cat.text, fontFamily: "Verdana, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", padding: "5px 16px", borderRadius: 999, marginBottom: 18 }}>
                {p.category}
              </span>
            )}

            {/* Title */}
            <h1 style={{ fontFamily: "var(--font-montserrat), Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(24px, 3.8vw, 50px)", color: "white", lineHeight: 1.12, marginBottom: 24, letterSpacing: "-0.025em", maxWidth: 820, textShadow: "0 2px 24px rgba(0,0,0,0.25)" }}>
              {p.title}
            </h1>

            {/* Meta row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center" }}>
              {p.author_name && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(127,226,227,0.15)", border: "2px solid rgba(127,226,227,0.4)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {p.author_image
                      ? <img src={p.author_image} alt={p.author_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#7fe2e3" }}>{String(p.author_name)[0]}</span>
                    }
                  </div>
                  <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{p.author_name}</span>
                </div>
              )}
              <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.2)", display: "inline-block" }} />
              {p.created_at && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "Verdana, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  <Calendar size={12} color="#7fe2e3" />{fmtDate(p.created_at)}
                </span>
              )}
              {p.read_time > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "Verdana, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  <Clock size={12} color="#7fe2e3" />{p.read_time} min read
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px 100px" }}>
        <div className="blog-layout" style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 56, alignItems: "start" }}>

          {/* ── LEFT — article ── */}
          <div>

            {/* Quick Answer / AEO */}
            {p.aeo_snippet && (
              <div style={{ background: "white", borderLeft: "4px solid #7fe2e3", borderRadius: "0 16px 16px 0", padding: "18px 24px", marginBottom: 40, boxShadow: "0 4px 20px rgba(127,226,227,0.08)", border: "1px solid rgba(127,226,227,0.2)", borderLeftWidth: 4, borderLeftColor: "#7fe2e3" }}>
                <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: "#7fe2e3", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>Quick Answer</p>
                <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 14, color: "#192537", lineHeight: 1.8, margin: 0 }}>
                  {p.aeo_snippet}
                </p>
              </div>
            )}

            {/* Article body */}
            <article className="blog-content" dangerouslySetInnerHTML={{ __html: p.content || "" }} />

            {/* Tags */}
            {tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 48, paddingTop: 28, borderTop: "1px solid #e8ecf0" }}>
                <Tag size={13} color="#c0c8d0" style={{ flexShrink: 0 }} />
                {tags.map(t => (
                  <span key={t} style={{ display: "inline-block", background: "white", border: "1px solid #e8ecf0", borderRadius: 999, padding: "5px 14px", fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7a8a9e" }}>
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* FAQs */}
            {faqs.length > 0 && (
              <div style={{ marginTop: 60 }}>
                <h2 style={{ fontFamily: "var(--font-montserrat), Montserrat, sans-serif", fontWeight: 700, fontSize: 22, color: "#192537", margin: "0 0 28px", display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ width: 4, height: 24, background: "#7fe2e3", borderRadius: 2, flexShrink: 0, display: "inline-block" }} />
                  Frequently Asked Questions
                </h2>
                {faqs.map((f, i) => (
                  <details key={i} style={{ borderBottom: "1px solid #eef0f3" }}>
                    <summary style={{ padding: "18px 0", fontFamily: "var(--font-montserrat), Montserrat, sans-serif", fontWeight: 600, fontSize: 15, color: "#192537", cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, userSelect: "none" }}>
                      {f.q}
                      <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", background: "#f0f4f8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#192537", lineHeight: 1 }}>+</span>
                    </summary>
                    <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", lineHeight: 1.9, padding: "4px 0 20px", margin: 0 }}>
                      {f.a}
                    </p>
                  </details>
                ))}
              </div>
            )}

            {/* Back link */}
            <div style={{ marginTop: 56 }}>
              <Link href="/blog" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#192537", textDecoration: "none", padding: "12px 22px", borderRadius: 999, background: "white", border: "1px solid #e8ecf0", boxShadow: "0 2px 8px rgba(25,37,55,0.05)" }}>
                <ArrowLeft size={14} /> Back to all articles
              </Link>
            </div>
          </div>

          {/* ── RIGHT — sidebar ── */}
          <div className="blog-sidebar" style={{ position: "sticky", top: 100 }}>

            {/* Author */}
            {p.author_name && (
              <div style={{ background: "white", borderRadius: 20, padding: "24px", boxShadow: "0 4px 24px rgba(25,37,55,0.06)", marginBottom: 16, border: "1px solid rgba(25,37,55,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: p.author_bio ? 16 : 0 }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,rgba(127,226,227,0.2),rgba(127,226,227,0.06))", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "2px solid rgba(127,226,227,0.25)" }}>
                    {p.author_image
                      ? <img src={p.author_image} alt={p.author_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 20, color: "#7fe2e3" }}>{String(p.author_name)[0]}</span>
                    }
                  </div>
                  <div>
                    <div style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 14, color: "#192537" }}>{p.author_name}</div>
                    <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#7fe2e3", marginTop: 3 }}>Elysian Advisory</div>
                  </div>
                </div>
                {p.author_bio && (
                  <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#7a8a9e", lineHeight: 1.8, margin: 0, paddingTop: 16, borderTop: "1px solid #f0f4f8" }}>
                    {p.author_bio}
                  </p>
                )}
              </div>
            )}

            {/* CTA */}
            <div style={{ background: "linear-gradient(145deg, #192537 0%, #0d1e2e 100%)", borderRadius: 20, padding: "28px 24px", boxShadow: "0 8px 32px rgba(25,37,55,0.22)", marginBottom: 16, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -24, right: -24, width: 120, height: 120, borderRadius: "50%", background: "rgba(127,226,227,0.06)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: -36, left: -24, width: 110, height: 110, borderRadius: "50%", background: "rgba(127,226,227,0.04)", pointerEvents: "none" }} />
              <div style={{ position: "relative" }}>
                <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 9, color: "#7fe2e3", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 14 }}>Free Consultation</p>
                <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 17, color: "white", lineHeight: 1.3, marginBottom: 12 }}>
                  Thinking about investing in Dubai?
                </h3>
                <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.75, marginBottom: 22 }}>
                  Our advisors give free, personalised guidance for every budget.
                </p>
                <a href="tel:+97140000000" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "13px", borderRadius: 12, background: "#7fe2e3", color: "#192537", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, textDecoration: "none", boxSizing: "border-box" }}>
                  <Phone size={14} /> Call Now
                </a>
              </div>
            </div>

            {/* Related projects */}
            {related.length > 0 && (
              <div style={{ background: "white", borderRadius: 20, padding: "20px 24px", boxShadow: "0 4px 24px rgba(25,37,55,0.06)", border: "1px solid rgba(25,37,55,0.05)" }}>
                <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 11, color: "#aab0ba", margin: "0 0 16px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Related Projects
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {related.map((s: string) => (
                    <Link key={s} href={`/projects/${s}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", background: "#f7f9fb", borderRadius: 12, textDecoration: "none", border: "1px solid #eef0f3" }}>
                      <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#192537" }}>
                        {s.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </span>
                      <ArrowUpRight size={13} color="#7fe2e3" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
      <Disclaimer />
      <CookieBanner />
      <FloatingContact />

      <style>{`
        @media (max-width: 1024px) {
          .blog-layout  { grid-template-columns: 1fr !important; }
          .blog-sidebar { position: static !important; }
        }
        details summary::-webkit-details-marker { display: none; }
        .blog-content a {
          color: #192537;
          font-weight: 700;
          text-decoration: underline;
          text-decoration-color: #7fe2e3;
          text-underline-offset: 3px;
          transition: color 0.2s;
        }
        .blog-content a:hover { color: #7fe2e3; }
        details[open] > summary span:last-child { transform: rotate(45deg); display: inline-flex; }
      `}</style>
    </main>
  );
}
