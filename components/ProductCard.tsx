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

function stripHtml(html?: string | null) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function getStockMeta(stockQty?: number | null, inStock?: boolean) {
  const qty = Number(stockQty ?? 0);
  const isOutOfStock = inStock === false || qty <= 0;

  if (isOutOfStock) {
    return {
      label: "Out of Stock",
      className: "border-red-200 bg-red-50 text-red-700",
      showQty: false,
    };
  }

  if (qty > 0 && qty <= 5) {
    return {
      label: "Low Stock",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      showQty: true,
    };
  }

  return {
    label: "In Stock",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    showQty: true,
  };
}

export default function ProductCard({ p }: { p: ProductCardInput }) {
  const slug = p.slug || toSlug(p.name) || toSlug(p.id);
  const href = normalizeRoute(p.route) || `/products/${slug}`;
  const pricePKR =
    p.price != null ? new Intl.NumberFormat("en-PK").format(p.price) : null;

  const stockMeta = getStockMeta(p.stock_qty, p.in_stock);
  const cleanDescription = stripHtml(p.description);

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_12px_35px_rgba(0,0,0,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(0,0,0,0.08)]"
    >
      <div className="relative overflow-hidden bg-neutral-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.image || "/images/placeholder.png"}
          alt={p.name}
          className="h-60 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />

        <div
          className={`absolute left-3 top-3 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] backdrop-blur ${stockMeta.className}`}
        >
          {stockMeta.label}
        </div>
      </div>

      <div className="p-4">
        {(p.brand || p.item_group) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {p.brand ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                {p.brand}
              </span>
            ) : null}

            {p.item_group ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                {p.item_group}
              </span>
            ) : null}
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 min-h-[52px] text-base font-semibold leading-6 text-neutral-900">
            {p.name}
          </h3>

          <div className="shrink-0 text-right font-bold text-vu-red">
            {pricePKR ? (
              <>Rs {pricePKR}</>
            ) : (
              <span className="font-medium text-neutral-400">—</span>
            )}
          </div>
        </div>

        {cleanDescription ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-600">
            {cleanDescription}
          </p>
        ) : (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-400">
            Premium product from Vape Ustad.
          </p>
        )}

        {stockMeta.showQty && typeof p.stock_qty === "number" ? (
          <div className="mt-3 text-xs font-medium text-neutral-500">
            Stock:{" "}
            <span className="font-semibold text-neutral-800">{p.stock_qty}</span>
          </div>
        ) : (
          <div className="mt-3 text-xs font-medium text-red-600">
            Currently unavailable
          </div>
        )}
      </div>
    </Link>
  );
}