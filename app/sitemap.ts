import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 3600; // regenerate every hour

const BASE = "https://offplansearchuae.com";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = supabase();

  const [projects, areas, developers, blogs] = await Promise.all([
    db.from("projects").select("slug,updated_at").eq("is_published", true),
    db.from("areas").select("slug,updated_at").eq("is_published", true),
    db.from("developers").select("slug,updated_at").eq("is_published", true),
    db.from("blog_posts").select("slug,updated_at").eq("is_published", true),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/projects`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/area-guides`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/developers`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  const projectRoutes: MetadataRoute.Sitemap = (projects.data ?? []).map((p) => ({
    url: `${BASE}/projects/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const areaRoutes: MetadataRoute.Sitemap = (areas.data ?? []).map((a) => ({
    url: `${BASE}/area-guides/${a.slug}`,
    lastModified: a.updated_at ? new Date(a.updated_at) : new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const developerRoutes: MetadataRoute.Sitemap = (developers.data ?? []).map((d) => ({
    url: `${BASE}/developers/${d.slug}`,
    lastModified: d.updated_at ? new Date(d.updated_at) : new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const blogRoutes: MetadataRoute.Sitemap = (blogs.data ?? []).map((b) => ({
    url: `${BASE}/blog/${b.slug}`,
    lastModified: b.updated_at ? new Date(b.updated_at) : new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...projectRoutes, ...areaRoutes, ...developerRoutes, ...blogRoutes];
}
