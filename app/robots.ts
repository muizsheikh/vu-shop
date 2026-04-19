import type { MetadataRoute } from "next";

const SITE_URL = "https://vapeustad.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/products", "/products/", "/contact"],
        disallow: ["/checkout", "/api/", "/success"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}