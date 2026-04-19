import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import AddToCartButton from "./ui";

export const dynamic = "force-dynamic";

type Product = {
  item_code: string;
  item_name: string;
  slug?: string | null;
  route?: string | null;
  image: string;
  price: number | null;
  currency?: string | null;
  description?: string | null;
  stock?: number | null;
  in_stock?: boolean;
  brand?: string | null;
  item_group?: string | null;
};

const SITE_NAME = "Vape Ustad";
const SITE_URL = "https://vapeustad.com";
const DEFAULT_IMAGE = "/images/placeholder.png";

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

function stripHtml(html?: string | null) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(text: string, max = 160) {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

function absoluteUrl(path?: string | null) {
  if (!path) return `${SITE_URL}${DEFAULT_IMAGE}`;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function getCanonicalUrl(slug: string) {
  return `${SITE_URL}/products/${slug}`;
}

function formatPKR(value: number | null) {
  if (value == null) return null;
  return new Intl.NumberFormat("en-PK").format(value);
}

function getStockMeta(stock: number, isOutOfStock: boolean) {
  if (isOutOfStock) {
    return {
      label: "Out of Stock",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (stock > 0 && stock <= 5) {
    return {
      label: "Low Stock",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "In Stock",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

async function getBaseUrlFromHeaders() {
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

async function loadProducts(): Promise<Product[]> {
  const base = await getBaseUrlFromHeaders();

  const res = await fetch(`${base}/api/products?limit=200`, {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const j = await res.json();
  return Array.isArray(j?.products) ? j.products : [];
}

function findProduct(products: Product[], slug: string) {
  return (
    products.find((x) => x.slug === slug) ||
    products.find((x) => lastSegment(x.route) === slug) ||
    products.find((x) => toSlug(x.item_name) === slug) ||
    products.find((x) => toSlug(x.item_code) === slug) ||
    null
  );
}

function buildProductDescription(product: Product) {
  const raw = stripHtml(product.description);
  if (raw) return truncate(raw, 160);

  const parts = [
    product.brand ? `${product.brand} product` : "Premium vaping product",
    product.item_group ? `in ${product.item_group}` : null,
    "available at Vape Ustad",
  ]
    .filter(Boolean)
    .join(" ");

  return truncate(
    `${parts}. Original quality, carefully selected stock, and a smooth shopping experience.`,
    160
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const products = await loadProducts();
  const product = findProduct(products, slug);

  if (!product) {
    return {
      title: "Product Not Found | Vape Ustad",
      description: "The requested product could not be found.",
      alternates: {
        canonical: `/products/${slug}`,
      },
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const description = buildProductDescription(product);
  const canonical = `/products/${product.slug || slug}`;
  const canonicalUrl = getCanonicalUrl(product.slug || slug);
  const image = absoluteUrl(product.image || DEFAULT_IMAGE);

  const titleParts = [product.item_name, product.brand, "Vape Ustad"].filter(Boolean);
  const title = titleParts.join(" | ");

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    keywords: [
      product.item_name,
      product.brand || "",
      product.item_group || "",
      "vape",
      "vape pakistan",
      "vape ustad",
      "e-liquid",
      "coil",
      "device",
    ].filter(Boolean),
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_PK",
      images: [
        {
          url: image,
          alt: product.item_name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function ProductDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const products = await loadProducts();

  const p = findProduct(products, slug);

  if (!p) return notFound();

  const stock = Number(p.stock ?? 0);
  const isOutOfStock = p.in_stock === false || stock <= 0;
  const pricePKR = formatPKR(p.price);
  const stockMeta = getStockMeta(stock, isOutOfStock);

  const ui = {
    id: p.item_code,
    slug: p.slug || slug,
    name: p.item_name,
    price: p.price ?? 0,
    image: p.image || DEFAULT_IMAGE,
    description: p.description || "",
  };

  const descriptionText = stripHtml(ui.description);
  const metadataDescription = buildProductDescription(p);
  const canonicalUrl = getCanonicalUrl(ui.slug);
  const productImage = absoluteUrl(ui.image);

  const related = products
    .filter((x) => x.item_code !== p.item_code)
    .filter((x) => {
      const sameBrand = p.brand && x.brand && p.brand === x.brand;
      const sameGroup =
        p.item_group && x.item_group && p.item_group === x.item_group;
      return sameBrand || sameGroup;
    })
    .slice(0, 4);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: ui.name,
    description: metadataDescription,
    sku: p.item_code,
    image: [productImage],
    brand: p.brand
      ? {
          "@type": "Brand",
          name: p.brand,
        }
      : undefined,
    category: p.item_group || undefined,
    url: canonicalUrl,
    offers: {
      "@type": "Offer",
      url: canonicalUrl,
      priceCurrency: p.currency || "PKR",
      price: p.price ?? 0,
      availability: isOutOfStock
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd),
        }}
      />

      <section className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            href="/products"
            className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
          >
            ← Back to products
          </Link>

          {p.brand ? (
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600">
              {p.brand}
            </span>
          ) : null}

          {p.item_group ? (
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600">
              {p.item_group}
            </span>
          ) : null}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
              <div className="aspect-square w-full overflow-hidden bg-neutral-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ui.image}
                  alt={ui.name}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                >
                  <div className="aspect-square bg-neutral-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ui.image}
                      alt={`${ui.name} preview ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)] md:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${stockMeta.className}`}
                >
                  {stockMeta.label}
                </span>

                {p.brand ? (
                  <span className="text-sm font-medium text-neutral-500">
                    Brand: <span className="text-neutral-800">{p.brand}</span>
                  </span>
                ) : null}

                {p.item_group ? (
                  <span className="text-sm font-medium text-neutral-500">
                    Category:{" "}
                    <span className="text-neutral-800">{p.item_group}</span>
                  </span>
                ) : null}
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950 md:text-4xl">
                {ui.name}
              </h1>

              <div className="mt-5">
                {pricePKR ? (
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-vu-red md:text-4xl">
                      Rs {pricePKR}
                    </span>
                  </div>
                ) : (
                  <div className="text-lg font-medium text-neutral-500">
                    Price on request
                  </div>
                )}
              </div>

              {!isOutOfStock ? (
                <div className="mt-3 text-sm text-neutral-600">
                  Available stock:{" "}
                  <span className="font-semibold text-neutral-900">{stock}</span>
                </div>
              ) : (
                <div className="mt-3 text-sm text-neutral-600">
                  This item is currently unavailable.
                </div>
              )}

              {descriptionText ? (
                <p className="mt-6 text-[15px] leading-7 text-neutral-600">
                  {descriptionText}
                </p>
              ) : (
                <p className="mt-6 text-[15px] leading-7 text-neutral-500">
                  Premium vaping product from Vape Ustad. Original quality,
                  carefully selected stock, and a smooth shopping experience.
                </p>
              )}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {isOutOfStock ? (
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-[52px] w-full cursor-not-allowed items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-100 px-5 py-3 text-base font-semibold text-neutral-400 sm:w-auto sm:min-w-[220px]"
                  >
                    Out of stock
                  </button>
                ) : (
                  <>
                    <AddToCartButton p={ui} />
                    <Link
                      href="/checkout"
                      className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-base font-semibold text-neutral-900 transition hover:bg-neutral-50 sm:w-auto sm:min-w-[180px]"
                    >
                      Buy Now
                    </Link>
                  </>
                )}
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <div className="text-sm font-semibold text-neutral-900">
                    100% Authentic Products
                  </div>
                  <div className="mt-1 text-sm text-neutral-600">
                    Carefully selected stock with trusted product sourcing.
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <div className="text-sm font-semibold text-neutral-900">
                    Fast Delivery
                  </div>
                  <div className="mt-1 text-sm text-neutral-600">
                    Quick order handling with smooth checkout experience.
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <div className="text-sm font-semibold text-neutral-900">
                    Cash on Delivery
                  </div>
                  <div className="mt-1 text-sm text-neutral-600">
                    Easy ordering for customers who prefer COD.
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <div className="text-sm font-semibold text-neutral-900">
                    Secure Checkout
                  </div>
                  <div className="mt-1 text-sm text-neutral-600">
                    Safe checkout flow with clean order confirmation.
                  </div>
                </div>
              </div>
            </div>

            {ui.description ? (
              <div className="mt-6 rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)] md:p-8">
                <h2 className="mb-4 text-lg font-bold text-neutral-950">
                  Product Details
                </h2>
                <div
                  className="prose max-w-none prose-p:text-neutral-700 prose-li:text-neutral-700 prose-strong:text-neutral-900"
                  dangerouslySetInnerHTML={{ __html: ui.description }}
                />
              </div>
            ) : null}
          </div>
        </div>

        {related.length ? (
          <div className="mt-14">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-neutral-950">
                  Related Products
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Similar picks you may also like.
                </p>
              </div>

              <Link
                href="/products"
                className="text-sm font-medium text-neutral-700 transition hover:text-neutral-950"
              >
                View all →
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {related.map((item) => (
                <Link
                  key={item.item_code}
                  href={
                    item.route || `/products/${item.slug || toSlug(item.item_name)}`
                  }
                  className="group overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_12px_35px_rgba(0,0,0,0.05)] transition hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(0,0,0,0.08)]"
                >
                  <div className="overflow-hidden bg-neutral-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image || DEFAULT_IMAGE}
                      alt={item.item_name}
                      className="h-56 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  </div>

                  <div className="p-4">
                    <div className="mb-2 flex flex-wrap gap-2">
                      {item.brand ? (
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                          {item.brand}
                        </span>
                      ) : null}

                      {item.item_group ? (
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                          {item.item_group}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="line-clamp-2 min-h-[48px] text-base font-semibold text-neutral-900">
                      {item.item_name}
                    </h3>

                    <div className="mt-3 font-bold text-vu-red">
                      {item.price != null
                        ? `Rs ${formatPKR(item.price)}`
                        : "Price on request"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}