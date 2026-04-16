// /app/products/[slug]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import AddToCartButton from "./ui";

export const dynamic = "force-dynamic";

type Product = {
  id: string;
  slug?: string | null;
  route?: string | null;
  name: string;
  image: string | null;
  price: number | null;
  description?: string | null;
  stock_qty?: number | null;
  in_stock?: boolean;
  brand?: string | null;
  item_group?: string | null;
};

const toSlug = (s: string) =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const lastSegment = (p?: string | null) =>
  (p || "").split("/").filter(Boolean).pop() || "";

async function loadProducts(): Promise<Product[]> {
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;

  const res = await fetch(`${base}/api/products?limit=200`, {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const j = await res.json();
  return j?.products ?? [];
}

function formatPKR(value: number | null) {
  if (value == null) return null;
  return new Intl.NumberFormat("en-PK").format(value);
}

export default async function ProductDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const products = await loadProducts();

  const p =
    products.find((x) => x.slug === slug) ||
    products.find((x) => lastSegment(x.route) === slug) ||
    products.find((x) => toSlug(x.name) === slug) ||
    products.find((x) => toSlug(x.id) === slug);

  if (!p) return notFound();

  const pricePKR = formatPKR(p.price);
  const isOutOfStock = p.in_stock === false || (p.stock_qty ?? 0) <= 0;

  const ui = {
    id: p.id,
    slug: p.slug || slug,
    name: p.name,
    price: p.price ?? 0,
    image: p.image || "/placeholder.png",
    description: p.description || "",
  };

  const related = products
    .filter((x) => x.id !== p.id)
    .filter((x) => {
      const sameBrand = p.brand && x.brand && p.brand === x.brand;
      const sameGroup = p.item_group && x.item_group && p.item_group === x.item_group;
      return sameBrand || sameGroup;
    })
    .slice(0, 4);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/products"
          className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          ← Back to products
        </Link>

        {p.brand ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/70">
            {p.brand}
          </span>
        ) : null}

        {p.item_group ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/70">
            {p.item_group}
          </span>
        ) : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          <div className="aspect-square w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ui.image}
              alt={ui.name}
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <div className="mb-3">
            {isOutOfStock ? (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
                Out of stock
              </span>
            ) : (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                In stock
              </span>
            )}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            {ui.name}
          </h1>

          <div className="mt-4">
            {pricePKR ? (
              <div className="text-3xl font-bold text-vu-red md:text-4xl">
                Rs {pricePKR}
              </div>
            ) : (
              <div className="text-lg text-white/60">Price on request</div>
            )}
          </div>

          {typeof p.stock_qty === "number" && !isOutOfStock ? (
            <div className="mt-3 text-sm text-white/60">
              Available stock:{" "}
              <span className="font-semibold text-white">{p.stock_qty}</span>
            </div>
          ) : null}

          {ui.description ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                Product details
              </h2>
              <p className="leading-7 text-white/80">{ui.description}</p>
            </div>
          ) : null}

          <div className="mt-8">
            {isOutOfStock ? (
              <button
                type="button"
                disabled
                className="w-full cursor-not-allowed rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base font-semibold text-white/40 md:w-auto md:min-w-[220px]"
              >
                Out of stock
              </button>
            ) : (
              <AddToCartButton p={ui as any} />
            )}
          </div>
        </div>
      </div>

      {related.length ? (
        <div className="mt-14">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Related products</h2>
            <Link
              href="/products"
              className="text-sm text-white/65 transition hover:text-white"
            >
              View all →
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {related.map((item) => (
              <Link
                key={item.id}
                href={item.route || `/products/${item.slug || toSlug(item.name)}`}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:border-white/20"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image || "/placeholder.png"}
                  alt={item.name}
                  className="h-52 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
                <div className="p-4">
                  <h3 className="line-clamp-2 font-semibold text-white">{item.name}</h3>
                  <div className="mt-2 font-semibold text-vu-red">
                    {item.price != null ? `Rs ${formatPKR(item.price)}` : "Price on request"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}