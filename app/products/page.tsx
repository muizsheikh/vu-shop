"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";

type Product = {
  id: string;
  name?: string | null;
  image: string | null;
  price: number | null;
  stock_qty?: number | null;
  in_stock?: boolean;
  item_group?: string | null;
  brand?: string | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function FilterChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700 shadow-sm">
      {label}: {value}
    </span>
  );
}

function ProductsInner() {
  const params = useSearchParams();

  const brand = params.get("brand") || "";
  const group = params.get("group") || "";
  const category = params.get("category") || "";
  const q = params.get("q") || "";
  const page = params.get("page") || "1";

  const apiUrl = `/api/products?brand=${encodeURIComponent(
    brand
  )}&group=${encodeURIComponent(group)}&category=${encodeURIComponent(
    category
  )}&q=${encodeURIComponent(q)}&page=${encodeURIComponent(page)}`;

  const { data, error, isLoading } = useSWR(apiUrl, fetcher);

  const BRANDS = [
    "Aspire",
    "Uwell",
    "Freemax",
    "GeekVape",
    "KUMIHO",
    "Lost Vape",
    "Oxva",
    "PAVA",
    "ROMIO",
    "SMOK",
    "Vaporesso",
    "Voopoo",
    "Yozo",
    "TOKYO DISPOSABLE",
    "H-ONE",
    "Used Pods",
    "Rincoe",
    "Reymont",
    "Chinese Pods",
    "WOMO",
  ];

  const activeBrand = brand.toLowerCase();

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center md:px-6">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
          <h1 className="text-2xl font-bold text-neutral-950 md:text-3xl">
            Products
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600 md:text-base">
            We could not load products right now. Please refresh the page and
            try again.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <div className="mb-8">
          <div className="h-10 w-52 animate-pulse rounded-2xl bg-neutral-200" />
          <div className="mt-3 h-5 w-80 animate-pulse rounded-xl bg-neutral-100" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
            <div className="mb-4 h-6 w-24 animate-pulse rounded-xl bg-neutral-200" />
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-2xl bg-neutral-100"
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_12px_35px_rgba(0,0,0,0.04)]"
              >
                <div className="h-60 animate-pulse bg-neutral-100" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-24 animate-pulse rounded bg-neutral-100" />
                  <div className="h-5 w-full animate-pulse rounded bg-neutral-200" />
                  <div className="h-5 w-3/4 animate-pulse rounded bg-neutral-100" />
                  <div className="h-4 w-20 animate-pulse rounded bg-neutral-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const products: Product[] = Array.isArray(data.products) ? data.products : [];

  const sorted = [...products].sort((a, b) => {
    const ai = a.in_stock === false || a.stock_qty === 0 ? 1 : 0;
    const bi = b.in_stock === false || b.stock_qty === 0 ? 1 : 0;

    if (ai !== bi) return ai - bi;

    const aName = (a.name || "").trim();
    const bName = (b.name || "").trim();

    return aName.localeCompare(bName);
  });

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950 md:text-4xl">
          Products
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 md:text-base">
          Explore premium Vape Ustad products with a clean shopping experience,
          clear pricing, and fast browsing by brand.
        </p>

        {(brand || group || category || q) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {brand ? <FilterChip label="Brand" value={brand} /> : null}
            {group ? <FilterChip label="Group" value={group} /> : null}
            {category ? <FilterChip label="Category" value={category} /> : null}
            {q ? <FilterChip label="Search" value={q} /> : null}

            <Link
              href="/products"
              className="inline-flex items-center rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700 transition hover:bg-neutral-50"
            >
              Clear Filters
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
        <aside className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)] lg:sticky lg:top-24">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-neutral-950">Brands</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Browse products by your preferred brand.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {BRANDS.map((b) => {
              const isActive = activeBrand === b.toLowerCase();

              return (
                <Link
                  key={b}
                  href={`/products?brand=${encodeURIComponent(b)}`}
                  className={`inline-flex min-h-[42px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-vu-red text-white shadow-sm"
                      : "border border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 hover:bg-white hover:text-neutral-900"
                  }`}
                >
                  {b}
                </Link>
              );
            })}

            {brand && (
              <Link
                href="/products"
                className="mt-2 inline-flex min-h-[42px] items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
              >
                Clear Brand
              </Link>
            )}
          </div>
        </aside>

        <div>
          <div className="mb-5 flex flex-col gap-3 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.05)] md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-neutral-950">
                {sorted.length} Product{sorted.length === 1 ? "" : "s"} Found
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                In-stock products are shown first for a smoother shopping flow.
              </p>
            </div>

            <div className="text-sm text-neutral-500">
              Premium selection by Vape Ustad
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="rounded-[28px] border border-neutral-200 bg-white p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-2xl">
                🔍
              </div>
              <h3 className="mt-4 text-xl font-bold text-neutral-950">
                No products found
              </h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Try changing the selected brand or clear the current filters to
                explore more items.
              </p>

              <Link
                href="/products"
                className="mt-5 inline-flex min-h-[46px] items-center justify-center rounded-2xl bg-vu-red px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
              >
                View All Products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {sorted.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-neutral-600">Loading…</div>
      }
    >
      <ProductsInner />
    </Suspense>
  );
}