"use client";

import { ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/cart";

type CartProduct = {
  id: string;
  slug?: string;
  name: string;
  price: number;
  image: string;
  description?: string;
};

export default function AddToCartButton({ p }: { p: CartProduct }) {
  const add = useCartStore((s) => s.add);

  return (
    <button
      type="button"
      className="inline-flex min-h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-[#a30105]/15 bg-white px-5 py-3 text-base font-semibold text-neutral-900 shadow-[0_10px_30px_rgba(0,0,0,0.05)] transition hover:bg-[#fff7f7] hover:border-[#a30105]/25 active:scale-[0.98] sm:w-auto sm:min-w-[220px]"
      onClick={() =>
        add(
          {
            id: p.id,
            slug: p.slug,
            name: p.name,
            price: p.price,
            image: p.image,
          },
          1
        )
      }
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#a30105]/10 text-[#a30105]">
        <ShoppingCart className="h-4.5 w-4.5" />
      </span>
      <span>Add to Cart</span>
    </button>
  );
}