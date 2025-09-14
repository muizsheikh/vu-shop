// /app/products/[slug]/ui.tsx
"use client";

import { useCartStore } from "@/store/cart"; // ✅ fixed
import type { Product } from "@/lib/products";

export default function AddToCartButton({ p }: { p: Product }) {
  const add = useCartStore((s) => s.add); // ✅ fixed

  return (
    <button
      className="inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium transition active:scale-95 bg-vu-red text-white hover:opacity-90 h-10 text-base"
      onClick={() =>
        add(
          {
            id: p.slug || p.id, // ✅ prefer slug if available
            slug: p.slug,
            name: p.name,
            price: p.price,
            image: p.image,
          },
          1
        )
      }
    >
      Add to Cart
    </button>
  );
}
