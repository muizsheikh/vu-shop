"use client";

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
      className="inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium transition active:scale-95 bg-vu-red text-white hover:opacity-90 h-10 text-base"
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
      Add to Cart
    </button>
  );
}