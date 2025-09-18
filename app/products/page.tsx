"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function ProductsInner() {
  const params = useSearchParams();
  const brand = params.get("brand") || "";
  const group = params.get("group") || "";
  const q = params.get("q") || "";
  const page = params.get("page") || "1";

  const apiUrl = `/api/products?brand=${encodeURIComponent(
    brand
  )}&group=${encodeURIComponent(group)}&q=${encodeURIComponent(
    q
  )}&page=${page}`;

  const { data, error, isLoading } = useSWR(apiUrl, fetcher);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-bold">Products</h1>
        <p className="mt-2 opacity-80">Error loading products.</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-xl bg-gray-800/40"
          />
        ))}
      </div>
    );
  }

  const products: Product[] = data.products || [];

  if (!products.length) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-bold">Products</h1>
        <p className="mt-2 opacity-80">No products found for this filter.</p>
      </div>
    );
  }

  const sorted = [...products].sort((a, b) => {
    const ai = a.in_stock === false || a.stock_qty === 0 ? 1 : 0;
    const bi = b.in_stock === false || b.stock_qty === 0 ? 1 : 0;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Products</h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {sorted.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProductsInner />
    </Suspense>
  );
}
