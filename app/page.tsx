import ProductCard from "@/components/ProductCard";
import { products } from "@/lib/products";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-black/5 dark:border-white/10 bg-gradient-to-br from-vu-black via-zinc-900 to-vu-black text-white">
        <div className="p-10 md:p-16">
          <p className="uppercase tracking-widest text-xs opacity-80">Vape Ustad</p>
          <h1 className="mt-2 text-3xl md:text-5xl font-extrabold">Premium Vape Store — Black / Red / White</h1>
          <p className="mt-3 opacity-80 max-w-2xl">Discover curated devices, coils, and e-liquids. Dark mode first, blazing fast, made in Next.js.</p>
          <div className="mt-6 flex gap-3">
            <Link href="#catalog"
  className="inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium transition active:scale-95 bg-vu-red text-white hover:opacity-90">
  Browse Products
</Link>
            <Link href="/contact"
  className="inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium transition active:scale-95 border border-vu-red text-vu-red hover:bg-vu-red hover:text-white">
  Contact
</Link>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section id="catalog" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Featured</h2>
          <p className="opacity-70 text-sm">Demo list — 4 items</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map(p => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>
    </div>
  );
}
