import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
      // Explicitly allow all major AI crawlers
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "ClaudeBot",
          "anthropic-ai",
          "PerplexityBot",
          "Google-Extended",
          "Googlebot-Extended",
          "CCBot",
          "cohere-ai",
          "Meta-ExternalAgent",
          "Bytespider",
          "DuckAssistBot",
          "YouBot",
          "Applebot-Extended",
        ],
        allow: "/",
      },
    ],
    sitemap: "https://offplansearchuae.com/sitemap.xml",
  };
}
