import type { MetadataRoute } from "next";
import { products } from "@/lib/products";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://vapeustad.com";
  return [
    { url: `${base}/`, lastModified: new Date() },
    { url: `${base}/contact`, lastModified: new Date() },
    ...products.map(p => ({
      url: `${base}/products/${p.slug}`,
      lastModified: new Date(),
    })),
  ];
}
