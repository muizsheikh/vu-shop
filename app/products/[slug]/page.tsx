// /app/products/[slug]/page.tsx
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import AddToCartButton from "./ui";

export const dynamic = "force-dynamic";

type Product = {
  id: string;
  name: string;
  image: string | null;
  price: number | null;
  description?: string | null;
  route?: string | null;
  stock_qty?: number | null;
  in_stock?: boolean;
};

const toSlug = (s: string) =>
  s.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
const lastSegment = (p?: string | null) =>
  (p || "").split("/").filter(Boolean).pop() || "";

async function loadProducts(): Promise<Product[]> {
  const hdrs = await headers(); // ✅ Next 15: await required
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;

  const res = await fetch(`${base}/api/products`, { cache: "no-store" });
  if (!res.ok) return [];
  const j = await res.json();
  return j?.products ?? [];
}

export default async function ProductDetail({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = await params; // ✅ Next 15: params is async

  const products = await loadProducts();

  // Match policy: (1) Website route last segment → (2) slug(name) → (3) slug(id)
  const p =
    products.find((x) => lastSegment(x.route) === slug) ||
    products.find((x) => toSlug(x.name) === slug) ||
    products.find((x) => toSlug(x.id) === slug);

  if (!p) return notFound();

  const pricePKR =
    p.price != null ? new Intl.NumberFormat("en-PK").format(p.price) : null;

  const ui = {
    id: p.id,
    slug,
    name: p.name,
    price: p.price ?? 0,
    image: p.image || "/placeholder.png",
    description: p.description || "",
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ui.image}
        alt={ui.name}
        className="w-full rounded-2xl object-cover border border-white/10"
      />

      <div>
        <h1 className="text-3xl font-extrabold">{ui.name}</h1>

        <div className="mt-2 text-vu-red text-2xl font-bold">
          {pricePKR ? <>Rs {pricePKR}</> : <span className="opacity-70">Price on request</span>}
        </div>

        {p.in_stock === false || p.stock_qty === 0 ? (
          <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-1 text-sm text-amber-300">
            Out of stock
          </div>
        ) : null}

        {ui.description ? (
          <p className="mt-4 opacity-80 leading-relaxed">{ui.description}</p>
        ) : null}

        <div className="mt-6">
          <AddToCartButton p={ui as any} />
        </div>
      </div>
    </div>
  );
}
