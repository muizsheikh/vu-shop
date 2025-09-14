// /store/cart.ts
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CartItem = {
  id: string;       // usually slug or name
  slug?: string;
  name: string;
  price: number;    // PKR
  image?: string;
  qty: number;
};

type ProductLike = {
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

// ✅ unified hook name = useCartStore
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      // Add new item or increase quantity
      add: (p, qty = 1) => {
        set((state) => {
          const id = p.slug || p.name;
          const idx = state.items.findIndex((it) => it.id === id);
          if (idx >= 0) {
            const next = [...state.items];
            next[idx] = { ...next[idx], qty: next[idx].qty + Math.max(1, qty) };
            return { items: next };
          }
          const item: CartItem = {
            id,
            slug: p.slug,
            name: p.name,
            price: Number(p.price) || 0,
            image: p.image,
            qty: Math.max(1, qty),
          };
          return { items: [...state.items, item] };
        });
      },

      // Increase qty by 1
      inc: (id) =>
        set((state) => ({
          items: state.items.map((it) =>
            it.id === id ? { ...it, qty: it.qty + 1 } : it
          ),
        })),

      // Decrease qty (remove if 0)
      dec: (id) =>
        set((state) => {
          const it = state.items.find((i) => i.id === id);
          if (!it) return {} as any;
          if (it.qty <= 1) {
            return { items: state.items.filter((i) => i.id !== id) };
          }
          return {
            items: state.items.map((i) =>
              i.id === id ? { ...i, qty: i.qty - 1 } : i
            ),
          };
        }),

      // Remove entire item
      remove: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      // Empty cart
      clear: () => set({ items: [] }),

      // Helpers
      total: () =>
        get().items.reduce((sum, it) => sum + it.price * it.qty, 0),
      count: () => get().items.reduce((sum, it) => sum + it.qty, 0),
    }),
    {
      name: "vu-cart",
      version: 1,
      storage:
        typeof window !== "undefined"
          ? createJSONStorage(() => localStorage)
          : undefined,
      partialize: (state) => ({ items: state.items }),
    }
  )
);
