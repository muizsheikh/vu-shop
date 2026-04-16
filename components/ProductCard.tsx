// /components/ProductCard.tsx
import Link from "next/link";

type ProductCardInput = {
  id: string;
  name: string;
  image: string | null;
  price: number | null;
  description?: string | null;
  route?: string | null;
  slug?: string | null;
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

const normalizeRoute = (route?: string | null) => {
  const r = (route || "").trim();
  if (!r) return null;
  return r.startsWith("/") ? r : `/${r}`;
};

export default function ProductCard({ p }: { p: ProductCardInput }) {
  const slug = p.slug || toSlug(p.name) || toSlug(p.id);
  const href = normalizeRoute(p.route) || `/products/${slug}`;
  const pricePKR = p.price != null ? new Intl.NumberFormat("en-PK").format(p.price) : null;
  const isOutOfStock = p.in_stock === false || p.stock_qty === 0;

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_10px_30px_rgba(0,0,0,.25)] transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07]"
    >
      <div className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.image || "/placeholder.png"}
          alt={p.name}
          className="h-56 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />

        {isOutOfStock ? (
          <div className="absolute left-3 top-3 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300 backdrop-blur">
            Out of stock
          </div>
        ) : (
          <div className="absolute left-3 top-3 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur">
            In stock
          </div>
        )}
      </div>

      <div className="p-4 text-sm">
        {(p.brand || p.item_group) && (
          <div className="mb-2 flex flex-wrap gap-2">
            {p.brand ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-wide text-white/65">
                {p.brand}
              </span>
            ) : null}
            {p.item_group ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-wide text-white/65">
                {p.item_group}
              </span>
            ) : null}
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 font-semibold leading-6 text-white">{p.name}</h3>
          <div className="shrink-0 font-semibold text-vu-red">
            {pricePKR ? <>Rs {pricePKR}</> : <span className="opacity-70">—</span>}
          </div>
        </div>

        {p.description ? (
          <p className="mt-2 line-clamp-2 text-white/65">{p.description}</p>
        ) : null}

        {!isOutOfStock && typeof p.stock_qty === "number" ? (
          <div className="mt-3 text-xs text-white/45">
            Stock: <span className="font-semibold text-white/70">{p.stock_qty}</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}