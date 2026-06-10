import Link from "next/link";

type ProductCardInput = {
  id: string;
  name?: string | null;
  item_name?: string | null;
  item_code?: string | null;
  image: string | null;
  images?: string[] | null;
  price: number | null;
  description?: string | null;
  route?: string | null;
  slug?: string | null;
  stock_qty?: number | null;
  stock?: number | null;
  in_stock?: boolean;
  brand?: string | null;
  item_group?: string | null;
};

const toSlug = (s: string) =>
  s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
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

function getAvailabilityMeta(
  stockQty?: number | null,
  stock?: number | null,
  inStock?: boolean
) {
  const qty = Number(stockQty ?? stock ?? 0);
  const unavailable = inStock === false || qty <= 0;

  if (unavailable) {
    return {
      label: "Unavailable",
      statusClassName: "text-red-600",
    };
  }

  return {
    label: "Available",
    statusClassName: "text-emerald-600",
  };
}

export default function ProductCard({ p }: { p: ProductCardInput }) {
  const name = p.name || p.item_name || p.item_code || p.id;
  const slug = p.slug || toSlug(name) || toSlug(p.id);
  const href = normalizeRoute(p.route) || `/products/${slug}`;

  const image =
    p.image || p.images?.find(Boolean) || "/images/placeholder.png";

  const pricePKR =
    p.price != null ? new Intl.NumberFormat("en-PK").format(p.price) : null;

  const availability = getAvailabilityMeta(p.stock_qty, p.stock, p.in_stock);
  const cleanDescription = stripHtml(p.description);

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.045)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(0,0,0,0.08)]"
    >
      <div className="relative overflow-hidden rounded-t-[24px] bg-[linear-gradient(180deg,#fafafa_0%,#f4f4f4_100%)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={name}
          className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.03] sm:h-52 md:h-56"
        />
      </div>

      <div className="space-y-3 p-3.5 md:p-4">
        {(p.brand || p.item_group) && (
          <div className="flex flex-wrap gap-2">
            {p.brand ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                {p.brand}
              </span>
            ) : null}

            {p.item_group ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                {p.item_group}
              </span>
            ) : null}
          </div>
        )}

        <div className="space-y-2">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-6 text-neutral-900 md:text-base">
            {name}
          </h3>

          {cleanDescription ? (
            <p className="line-clamp-2 text-sm leading-5 text-neutral-600">
              {cleanDescription}
            </p>
          ) : (
            <p className="line-clamp-2 text-sm leading-5 text-neutral-400">
              Premium product from Vape Ustad.
            </p>
          )}
        </div>

        <div className="flex items-end justify-between gap-3 border-t border-neutral-100 pt-3">
          <div>
            {pricePKR ? (
              <div className="text-lg font-bold tracking-tight text-neutral-950">
                Rs {pricePKR}
              </div>
            ) : (
              <div className="text-sm font-semibold tracking-tight text-neutral-500">
                Price on request
              </div>
            )}
          </div>

          <div className={`text-xs font-semibold ${availability.statusClassName}`}>
            {availability.label}
          </div>
        </div>
      </div>
    </Link>
  );
}