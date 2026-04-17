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
      type="button"
      className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-vu-red px-5 py-3 text-base font-semibold text-white transition hover:opacity-95 active:scale-[0.98] sm:w-auto sm:min-w-[220px]"
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