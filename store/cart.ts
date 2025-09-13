"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CartItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  qty: number;
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  total: () => number;
  count: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item, qty = 1) => {
        const next = [...get().items];
        const i = next.findIndex(x => x.id === item.id);
        if (i >= 0) next[i].qty += qty;
        else next.push({ ...item, qty });
        set({ items: next });
      },
      inc: id => set({ items: get().items.map(x => x.id === id ? { ...x, qty: x.qty + 1 } : x) }),
      dec: id => set({ items: get().items.map(x => x.id === id ? { ...x, qty: Math.max(1, x.qty - 1) } : x) }),
      remove: id => set({ items: get().items.filter(x => x.id !== id) }),
      clear: () => set({ items: [] }),
      total: () => get().items.reduce((s, x) => s + x.price * x.qty, 0),
      count: () => get().items.reduce((s, x) => s + x.qty, 0),
    }),
    { name: "vu-cart", storage: createJSONStorage(() => localStorage) }
  )
);
