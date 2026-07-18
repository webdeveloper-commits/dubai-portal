import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import ProjectDetailClient from "./ProjectDetailClient";

type Props = { params: Promise<{ slug: string }> };

// ─── SEO metadata (server-rendered) ─────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabase
    .from("projects")
    .select("name,seo_title,seo_description,seo_keywords,tagline,image_main,geo_summary,developer_slug,price_from,description_short")
    .eq("slug", slug)
    .single();

  if (!data) return { title: "Project | Elysian Dubai" };

  const name     = data.name as string;
  const title    = (data.seo_title || `${name} | Off-Plan Property in Dubai`) as string;
  // seo_description → description_short fallback → constructed fallback
  const rawDesc  = (data.seo_description as string | null) || (data.description_short as string | null);
  const desc     = rawDesc
    ? rawDesc.slice(0, 160)
    : `${data.tagline || `Discover ${name}`} in ${data.geo_summary || "Dubai"}. Starting from AED ${Number(data.price_from || 0).toLocaleString()}.`;
  const keywords = Array.isArray(data.seo_keywords)
    ? (data.seo_keywords as string[])
    : typeof data.seo_keywords === "string"
      ? [data.seo_keywords as string]
      : undefined;
  const imageUrl = data.image_main as string | null;
  const pageUrl  = `https://dubai-portal.vercel.app/projects/${slug}`;

  return {
    title,
    description: desc,
    keywords,
    openGraph: {
      title,
      description: desc,
      url: pageUrl,
      type: "website",
      siteName: "Elysian Realty Dubai",
      locale: "en_AE",
      images: imageUrl
        ? [{ url: imageUrl, width: 1200, height: 630, alt: `${name} - Dubai property` }]
        : [{ url: "https://elysianrealtydubai.ae/og-default.jpg", width: 1200, height: 630, alt: "Elysian Realty Dubai" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: imageUrl ? [imageUrl] : [],
    },
    alternates: { canonical: pageUrl },
  };
}

// ─── Page (server component — injects JSON-LD, renders client) ──────────────

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;

  // Fetch only what's needed for structured data — client fetches full data itself
  const { data } = await supabase
    .from("projects")
    .select("name,seo_title,seo_description,geo_summary,price_from,latitude,longitude,aeo_faq,developer_slug")
    .eq("slug", slug)
    .single();

  // ── FAQ schema (AEO — Answer Engine Optimisation) ──────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faqItems = Array.isArray(data?.aeo_faq) ? data!.aeo_faq as any[] : [];
  const faqSchema = faqItems.length > 0 ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map(f => ({
      "@type": "Question",
      name: f.question ?? f.q ?? "",
      acceptedAnswer: { "@type": "Answer", text: f.answer ?? f.a ?? "" },
    })),
  }) : null;

  // ── RealEstateListing / LocalBusiness schema (GEO) ────────────────────────
  const lat = data?.latitude as number | null;
  const lon = data?.longitude as number | null;
  const geoSchema = data ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    name: data.name,
    description: data.seo_description || "",
    address: {
      "@type": "PostalAddress",
      addressLocality: (data.geo_summary as string || "").split(",")[0]?.trim() || "Dubai",
      addressCountry: "AE",
    },
    ...(lat && lon ? { geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lon } } : {}),
    ...(data.price_from ? { offers: { "@type": "Offer", priceCurrency: "AED", price: data.price_from, availability: "https://schema.org/PreOrder" } } : {}),
    url: `https://dubai-portal.vercel.app/projects/${slug}`,
  }) : null;

  // ── BreadcrumbList schema ─────────────────────────────────────────────────
  const breadcrumbSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home",     item: "https://dubai-portal.vercel.app" },
      { "@type": "ListItem", position: 2, name: "Projects", item: "https://dubai-portal.vercel.app/projects" },
      { "@type": "ListItem", position: 3, name: data?.name ?? slug, item: `https://dubai-portal.vercel.app/projects/${slug}` },
    ],
  });

  return (
    <>
      {/* Structured data — server-rendered, always in initial HTML */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
      {geoSchema     && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: geoSchema }} />}
      {faqSchema     && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqSchema }} />}
      {/* Client component handles all interactive rendering */}
      <ProjectDetailClient params={params} />
    </>
  );
}
