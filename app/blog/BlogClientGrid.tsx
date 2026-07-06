"use client";
import { useState } from "react";
import Link from "next/link";
import { Calendar, Clock, ArrowUpRight } from "lucide-react";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: string;
  tags: string[];
  read_time: number;
  cover_image: string;
  excerpt: string;
  author_name: string;
  featured: boolean;
  created_at: string;
}

const CATS = ["All", "Market News", "Area Guides", "Investment Tips", "Developer Profiles", "Project Updates"];

const CAT_COLORS: Record<string, string> = {
  "Market News":        "#f97316",
  "Area Guides":        "#10b981",
  "Investment Tips":    "#7fe2e3",
  "Developer Profiles": "#6366f1",
  "Project Updates":    "#192537",
};

function fmtDate(s: string) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function BlogCard({ post }: { post: BlogPost }) {
  const cc = CAT_COLORS[post.category] || "#192537";
  return (
    <Link href={`/blog/${post.slug}`} style={{ textDecoration: "none", display: "block", height: "100%" }}>
      <article
        style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 16px rgba(25,37,55,0.06)", border: "1px solid rgba(25,37,55,0.06)", height: "100%", display: "flex", flexDirection: "column", transition: "transform 0.25s, box-shadow 0.25s", cursor: "pointer" }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translateY(-4px)"; el.style.boxShadow = "0 14px 40px rgba(25,37,55,0.12)"; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translateY(0)"; el.style.boxShadow = "0 2px 16px rgba(25,37,55,0.06)"; }}
      >
        <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden", flexShrink: 0, background: "#0d1e2e" }}>
          {post.cover_image
            ? <img src={post.cover_image} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #192537 0%, #0d1e2e 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, color: "#7fe2e3", letterSpacing: "0.12em", textTransform: "uppercase" }}>Elysian Blog</span>
              </div>
          }
          {post.category && (
            <span style={{ position: "absolute", top: 12, left: 12, background: cc, color: "white", fontFamily: "Verdana, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 999 }}>
              {post.category}
            </span>
          )}
        </div>

        <div style={{ padding: "20px 22px 22px", display: "flex", flexDirection: "column", flex: 1 }}>
          <h3 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 16, color: "#192537", margin: "0 0 10px", lineHeight: 1.35 }}>
            {post.title}
          </h3>
          {post.excerpt && (
            <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "#7a8a9e", lineHeight: 1.75, margin: "0 0 16px", flex: 1 }}>
              {post.excerpt.slice(0, 120)}{post.excerpt.length > 120 ? "…" : ""}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 14, borderTop: "1px solid #f0f0f0" }}>
            <div style={{ display: "flex", gap: 14 }}>
              {post.created_at && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#aaa" }}>
                  <Calendar size={10} color="#7fe2e3" />{fmtDate(post.created_at)}
                </span>
              )}
              {post.read_time > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#aaa" }}>
                  <Clock size={10} color="#7fe2e3" />{post.read_time} min
                </span>
              )}
            </div>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#192537", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ArrowUpRight size={14} color="white" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function BlogClientGrid({ posts }: { posts: BlogPost[] }) {
  const [cat, setCat] = useState("All");

  const featured  = posts.find(p => p.featured);
  const filtered  = cat === "All" ? posts : posts.filter(p => p.category === cat);
  const gridPosts = filtered.filter(p => !(cat === "All" && p.featured && p.id === featured?.id));

  return (
    <>
      {/* Category tabs */}
      <div style={{ background: "#192537", padding: "0 24px", overflowX: "auto" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 0 }}>
          {CATS.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{
              padding: "16px 20px", border: "none", background: "transparent", cursor: "pointer",
              fontFamily: "Verdana, sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
              color: cat === c ? "#7fe2e3" : "rgba(255,255,255,0.45)",
              borderBottom: cat === c ? "2px solid #7fe2e3" : "2px solid transparent",
              whiteSpace: "nowrap", transition: "color 0.2s, border-color 0.2s",
            }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Featured hero post */}
      {featured && cat === "All" && (
        <section style={{ background: "#f9f9f9", padding: "48px 24px 0" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <Link href={`/blog/${featured.slug}`} style={{ textDecoration: "none", display: "block" }}>
              <div
                className="feat-grid"
                style={{ borderRadius: 24, overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1fr", background: "white", boxShadow: "0 4px 32px rgba(25,37,55,0.10)", border: "1px solid rgba(25,37,55,0.06)", transition: "box-shadow 0.3s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 48px rgba(25,37,55,0.16)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 32px rgba(25,37,55,0.10)"; }}
              >
                <div style={{ position: "relative", minHeight: 340, background: "#0d1e2e", overflow: "hidden" }}>
                  {featured.cover_image
                    ? <img src={featured.cover_image} alt={featured.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", position: "absolute", inset: 0 }} />
                    : <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #192537 0%, #0d1e2e 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 18, color: "#7fe2e3" }}>Featured</span>
                      </div>
                  }
                  <span style={{ position: "absolute", top: 16, left: 16, background: "#7fe2e3", color: "#192537", fontFamily: "Verdana, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "5px 14px", borderRadius: 999 }}>
                    Featured
                  </span>
                </div>
                <div style={{ padding: "44px 48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  {featured.category && (
                    <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 10, color: CAT_COLORS[featured.category] || "#7fe2e3", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16 }}>
                      {featured.category}
                    </span>
                  )}
                  <h2 style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "clamp(20px, 2.5vw, 30px)", color: "#192537", lineHeight: 1.25, marginBottom: 16, letterSpacing: "-0.02em" }}>
                    {featured.title}
                  </h2>
                  {featured.excerpt && (
                    <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "#7a8a9e", lineHeight: 1.8, marginBottom: 28 }}>
                      {featured.excerpt.slice(0, 160)}{featured.excerpt.length > 160 ? "…" : ""}
                    </p>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 16 }}>
                      {featured.created_at && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#aaa" }}>
                          <Calendar size={11} color="#7fe2e3" />{fmtDate(featured.created_at)}
                        </span>
                      )}
                      {featured.read_time > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "Verdana, sans-serif", fontSize: 11, color: "#aaa" }}>
                          <Clock size={11} color="#7fe2e3" />{featured.read_time} min read
                        </span>
                      )}
                    </div>
                    <div style={{ marginLeft: "auto", width: 40, height: 40, borderRadius: "50%", background: "#192537", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <ArrowUpRight size={16} color="white" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Grid */}
      <section style={{ background: "#f9f9f9", padding: "48px 24px 96px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {gridPosts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 20, color: "#192537", marginBottom: 10 }}>
                {cat === "All" ? "No articles published yet" : `No ${cat} articles yet`}
              </p>
              {cat !== "All" && (
                <button onClick={() => setCat("All")} style={{ marginTop: 16, background: "#192537", color: "white", fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: 13, padding: "12px 28px", borderRadius: 999, border: "none", cursor: "pointer" }}>
                  View All Articles
                </button>
              )}
            </div>
          ) : (
            <div className="blog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 28 }}>
              {gridPosts.map(p => <BlogCard key={p.id} post={p} />)}
            </div>
          )}
        </div>
      </section>

      <style>{`
        @media (max-width: 1024px) {
          .blog-grid { grid-template-columns: repeat(2,1fr) !important; }
          .feat-grid  { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) { .blog-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  );
}
