"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";

type Product = {
  id: string;
  name: string;
  image: string | null;
  price: number | null;
  stock_qty?: number | null;
  in_stock?: boolean;
  item_group?: string | null;
  brand?: string | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** -------------------- Inner (Suspense) -------------------- **/
function ProductsInner() {
  const params = useSearchParams();

  const brand = params.get("brand") || "";
  const group = params.get("group") || "";
  const q = params.get("q") || "";
  const page = params.get("page") || "1";

  // Build API URL with filters
  const apiUrl = `/api/products?brand=${encodeURIComponent(
    brand
  )}&group=${encodeURIComponent(group)}&q=${encodeURIComponent(
    q
  )}&page=${encodeURIComponent(page)}`;

  const { data, error, isLoading } = useSWR(apiUrl, fetcher);

  const BRANDS = [
    "Aspire","Uwell","Freemax","GeekVape","KUMIHO","Lost Vape","Oxva","PAVA",
    "ROMIO","SMOK","Vaporesso","Voopoo","Yozo","TOKYO DISPOSABLE","H-ONE",
    "Used Pods","Rincoe","Reymont","Chinese Pods","WOMO",
  ];
  const activeBrand = brand.toLowerCase();

  if (error)
    return (
      <div className="mx-auto max-w-2xl text-center py-16">
        <h1 className="text-2xl font-bold">Products</h1>
        <p className="mt-2 opacity-80">Error loading products.</p>
      </div>
    );

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-800/40" />
        ))}
      </div>
    );
  }

  const products: Product[] = data.products || [];
  const sorted = [...products].sort((a, b) => {
    const ai = a.in_stock === false || a.stock_qty === 0 ? 1 : 0;
    const bi = b.in_stock === false || b.stock_qty === 0 ? 1 : 0;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex">
      {/* Sidebar: Brands (pill buttons) */}
      <aside className="w-60 shrink-0 space-y-4">
        <div className="rounded-xl border border-black/10 dark:border-white/10 p-6">
          <h3 className="text-lg font-semibold mb-4">Brands</h3>
          <div className="flex flex-col gap-2">
            {BRANDS.map((b) => {
              const isActive = activeBrand === b.toLowerCase();
              return (
                <Link
                  key={b}
                  href={`/products?brand=${encodeURIComponent(b)}`}
                  className={`block w-full px-3 py-2 rounded-lg text-sm text-center transition ${
                    isActive
                      ? "bg-vu-red text-white font-semibold"
                      : "bg-zinc-900 hover:bg-zinc-800 text-gray-300"
                  }`}
                >
                  {b}
                </Link>
              );
            })}
            {/* Clear brand filter */}
            {brand && (
              <Link
                href="/products"
                className="block w-full px-3 py-2 rounded-lg text-sm text-center border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                Clear Brand
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Grid */}
      <div className="flex-1 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            Products
            {brand && (
              <span className="ml-2 text-base font-normal opacity-70">
                — Brand: {brand}
              </span>
            )}
            {group && (
              <span className="ml-2 text-base font-normal opacity-70">
                — Group: {group}
              </span>
            )}
            {q && (
              <span className="ml-2 text-base font-normal opacity-70">
                — Search: {q}
              </span>
            )}
          </h1>
        </div>

        {sorted.length === 0 ? (
          <div className="opacity-80">No products found for this filter.</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {sorted.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** -------------------- Page (wrap inner in Suspense) -------------------- **/
export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center">Loading…</div>}>
      <ProductsInner />
    </Suspense>
  );
}
