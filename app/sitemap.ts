import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://vapeustad.com";
  const now = new Date();

  return [
    { url: `${base}/`, lastModified: now },
    { url: `${base}/products`, lastModified: now },
    { url: `${base}/contact`, lastModified: now },
    { url: `${base}/checkout`, lastModified: now },
  ];
}