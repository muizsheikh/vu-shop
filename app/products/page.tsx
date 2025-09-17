// /app/products/page.tsx
import { headers } from "next/headers";
import ProductCard from "@/components/ProductCard";

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

async function loadProducts(): Promise<Product[]> {
  const hdrs = await headers(); // ✅ Next 15: await required
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;

  const res = await fetch(`${base}/api/products`, { cache: "no-store" });
  if (!res.ok) return [];
  const j = await res.json();
  return (j?.products as Product[]) ?? [];
}

export default async function ProductsPage() {
  const products = await loadProducts();

  if (!products.length) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-bold">Products</h1>
        <p className="mt-2 opacity-80">
          Abhi koi product publish nahi hai. ERPNext me{" "}
          <span className="font-semibold">Website Item → Published = 1</span> karein,
          (Price List & image set) — phir yahan auto show ho jayenge.
        </p>
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
