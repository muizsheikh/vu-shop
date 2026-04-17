"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CartItem = {
  id: string;
  slug?: string;
  name: string;
  price: number;
  image?: string;
  qty: number;
};

type ProductLike = {
  id?: string;
  slug?: string;
  name: string;
  price: number;
  image?: string;
};

type CartState = {
  items: CartItem[];
  add: (p: ProductLike, qty?: number) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  total: () => number;
  count: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      add: (p, qty = 1) => {
        const safeQty = Math.max(1, Number(qty) || 1);
        const id = String(p.id || p.slug || p.name).trim();

        if (!id) return;

        set((state) => {
          const idx = state.items.findIndex((it) => it.id === id);

          if (idx >= 0) {
            const next = [...state.items];
            next[idx] = {
              ...next[idx],
              qty: next[idx].qty + safeQty,
            };
            return { items: next };
          }

          const item: CartItem = {
            id,
            slug: p.slug,
            name: p.name,
            price: Number(p.price) || 0,
            image: p.image,
            qty: safeQty,
          };

          return { items: [...state.items, item] };
        });
      },

      inc: (id) =>
        set((state) => ({
          items: state.items.map((it) =>
            it.id === id ? { ...it, qty: it.qty + 1 } : it
          ),
        })),

      dec: (id) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === id);
          if (!existing) return { items: state.items };

          if (existing.qty <= 1) {
            return { items: state.items.filter((i) => i.id !== id) };
          }

          return {
            items: state.items.map((i) =>
              i.id === id ? { ...i, qty: i.qty - 1 } : i
            ),
          };
        }),

      remove: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        })),

      clear: () => set({ items: [] }),

      total: () =>
        get().items.reduce((sum, it) => sum + it.price * it.qty, 0),

      count: () =>
        get().items.reduce((sum, it) => sum + it.qty, 0),
    }),
    {
      name: "vu-cart",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);