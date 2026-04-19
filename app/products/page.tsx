import type { Metadata } from "next";
import ProductsClient from "./ProductsClient";

const SITE_URL = "https://vapeustad.com";

function buildProductsMetadata(searchParams?: {
  brand?: string;
  group?: string;
  category?: string;
  q?: string;
  min_price?: string;
  max_price?: string;
  sort?: string;
  in_stock?: string;
  page?: string;
}): Metadata {
  const brand = searchParams?.brand?.trim() || "";
  const group = searchParams?.group?.trim() || "";
  const category = searchParams?.category?.trim() || "";
  const q = searchParams?.q?.trim() || "";
  const minPrice = searchParams?.min_price?.trim() || "";
  const maxPrice = searchParams?.max_price?.trim() || "";
  const sort = searchParams?.sort?.trim() || "";
  const inStock = searchParams?.in_stock === "1";
  const page = searchParams?.page?.trim() || "";

  const titleParts: string[] = [];

  if (q) titleParts.push(`Search: ${q}`);
  if (category) titleParts.push(category);
  if (group) titleParts.push(group);
  if (brand) titleParts.push(brand);

  const title =
    titleParts.length > 0
      ? `${titleParts.join(" | ")} Products`
      : "Products";

  const descriptionParts: string[] = [];

  if (q) descriptionParts.push(`Search results for "${q}"`);
  else descriptionParts.push("Browse premium Vape Ustad products");

  if (category) descriptionParts.push(`category: ${category}`);
  if (group) descriptionParts.push(`group: ${group}`);
  if (brand) descriptionParts.push(`brand: ${brand}`);
  if (inStock) descriptionParts.push("in-stock only");

  if (minPrice || maxPrice) {
    if (minPrice && maxPrice) {
      descriptionParts.push(`price range Rs ${minPrice} to Rs ${maxPrice}`);
    } else if (minPrice) {
      descriptionParts.push(`price from Rs ${minPrice}`);
    } else if (maxPrice) {
      descriptionParts.push(`price up to Rs ${maxPrice}`);
    }
  }

  if (sort === "price_asc") descriptionParts.push("sorted by price low to high");
  if (sort === "price_desc") descriptionParts.push("sorted by price high to low");
  if (page && page !== "1") descriptionParts.push(`page ${page}`);

  const description = `${descriptionParts.join(", ")}. Explore devices, coils, e-liquids, disposables, and more at Vape Ustad.`;

  const canonicalParams = new URLSearchParams();
  if (brand) canonicalParams.set("brand", brand);
  if (group) canonicalParams.set("group", group);
  if (category) canonicalParams.set("category", category);
  if (q) canonicalParams.set("q", q);
  if (minPrice) canonicalParams.set("min_price", minPrice);
  if (maxPrice) canonicalParams.set("max_price", maxPrice);
  if (sort) canonicalParams.set("sort", sort);
  if (inStock) canonicalParams.set("in_stock", "1");
  if (page && page !== "1") canonicalParams.set("page", page);

  const canonical = canonicalParams.toString()
    ? `/products?${canonicalParams.toString()}`
    : "/products";

  const absoluteCanonical = `${SITE_URL}${canonical}`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: `${title} | Vape Ustad`,
      description,
      url: absoluteCanonical,
      siteName: "Vape Ustad",
      type: "website",
      locale: "en_PK",
      images: [
        {
          url: `${SITE_URL}/og.png`,
          alt: "Vape Ustad Products",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Vape Ustad`,
      description,
      images: [`${SITE_URL}/og.png`],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{
    brand?: string;
    group?: string;
    category?: string;
    q?: string;
    min_price?: string;
    max_price?: string;
    sort?: string;
    in_stock?: string;
    page?: string;
  }>;
}): Promise<Metadata> {
  const params = await searchParams;
  return buildProductsMetadata(params);
}

export default function ProductsPage() {
  return <ProductsClient />;
}