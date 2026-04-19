import type { MetadataRoute } from "next";

type Product = {
  item_code: string;
  item_name: string;
  slug?: string | null;
  route?: string | null;
};

const SITE_URL = "https://vapeustad.com";

const toSlug = (s: string) =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const lastSegment = (p?: string | null) =>
  (p || "").split("/").filter(Boolean).pop() || "";

async function loadProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${SITE_URL}/api/products?limit=500`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return Array.isArray(data?.products) ? data.products : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/products`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/checkout`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.4,
    },
  ];

  const products = await loadProducts();

  const seen = new Set<string>();

  const productPages: MetadataRoute.Sitemap = products
    .map((product) => {
      const slug =
        product.slug ||
        lastSegment(product.route) ||
        toSlug(product.item_name) ||
        toSlug(product.item_code);

      const url = `${SITE_URL}/products/${slug}`;

      if (!slug || seen.has(url)) return null;
      seen.add(url);

      return {
        url,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.8,
      };
    })
    .filter(Boolean) as MetadataRoute.Sitemap;

  return [...staticPages, ...productPages];
}