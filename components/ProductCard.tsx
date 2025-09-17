// /components/ProductCard.tsx
import Link from "next/link";

type ProductCardInput = {
  id: string;
  name: string;
  image: string | null;
  price: number | null;
  description?: string | null;
  // optional fields if coming from /api/products:
  route?: string | null;
  stock_qty?: number | null;
  in_stock?: boolean;
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

export default function ProductCard({ p }: { p: ProductCardInput }) {
  // Prefer Website Item route (last segment); fallback to slug(name) or slug(id)
  const slug = lastSegment(p.route) || toSlug(p.name) || toSlug(p.id);
  const pricePKR = p.price != null ? new Intl.NumberFormat("en-PK").format(p.price) : null;

  return (
    <Link
      href={`/products/${slug}`}
      className="block overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_10px_30px_rgba(0,0,0,.25)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={p.image || "/placeholder.png"}
        alt={p.name}
        className="h-56 w-full object-cover"
      />

      <div className="p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold line-clamp-1">{p.name}</h3>
          <div className="shrink-0 font-semibold text-vu-red">
            {pricePKR ? <>Rs {pricePKR}</> : <span className="opacity-70">—</span>}
          </div>
        </div>

        {p.description ? (
          <p className="mt-1 opacity-70 line-clamp-2">{p.description}</p>
        ) : null}

        {p.in_stock === false || p.stock_qty === 0 ? (
          <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/20 px-2 py-0.5 text-xs text-amber-300">
            Out of stock
          </div>
        ) : null}
      </div>
    </Link>
  );
}
