import Link from "next/link";
import type { Product } from "@/lib/products";

export default function ProductCard({ p }: { p: Product }) {
  return (
    <Link
      href={`/products/${p.slug}`}
      className="block overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_10px_30px_rgba(0,0,0,.25)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={p.image}
        alt={p.name}
        className="h-56 w-full object-cover"
      />
      <div className="p-4 text-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{p.name}</h3>
          <div className="font-semibold text-vu-red">
            Rs {p.price.toLocaleString()}
          </div>
        </div>
        <p className="mt-1 opacity-70">{p.description}</p>
      </div>
    </Link>
  );
}

