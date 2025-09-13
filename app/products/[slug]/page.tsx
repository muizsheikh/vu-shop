import type { Metadata } from "next";
import { getBySlug } from "@/lib/products";
import { notFound } from "next/navigation";
import AddToCartButton from "./ui";

export const dynamic = "force-dynamic"; // ⬅️ prerender hata do (runtime pe render)

const BASE = "https://vapeustad.com";

/** Dynamic SEO for each product */
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const p = getBySlug(params.slug);
  if (!p) return { title: "Product not found — Vape Ustad" };

  const title = `${p.name} — Vape Ustad`;
  const url = `${BASE}/products/${p.slug}`;
  const img = p.image.startsWith("http") ? p.image : `${BASE}${p.image}`;

  return {
    title,
    description: p.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: p.description,
      url,
      siteName: "Vape Ustad",
      images: [img],
      type: "product",
    },
    twitter: { card: "summary_large_image", title, description: p.description, images: [img] },
  };
}

export default function ProductDetail({ params }: { params: { slug: string } }) {
  const p = getBySlug(params.slug);
  if (!p) return notFound();

  // JSON-LD ko server-safe tarike se prepare karein
  const imgAbs = p.image.startsWith("http") ? p.image : `${BASE}${p.image}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image: [imgAbs],
    url: `${BASE}/products/${p.slug}`,
    offers: {
      "@type": "Offer",
      priceCurrency: "PKR",
      price: p.price.toString(),
      availability: "https://schema.org/InStock",
      url: `${BASE}/products/${p.slug}`,
    },
    brand: { "@type": "Brand", name: "Vape Ustad" },
  };

  return (
    <>
      <div className="grid gap-8 md:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.image}
          alt={p.name}
          className="w-full rounded-2xl object-cover border border-white/10"
        />

        <div>
          <h1 className="text-3xl font-extrabold">{p.name}</h1>
          <div className="mt-2 text-vu-red text-2xl font-bold">
            Rs {p.price.toLocaleString()}
          </div>
          <p className="mt-4 opacity-80 leading-relaxed">{p.description}</p>
          <div className="mt-6">
            <AddToCartButton p={p} />
          </div>
        </div>
      </div>

      {/* JSON-LD Schema.org */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
