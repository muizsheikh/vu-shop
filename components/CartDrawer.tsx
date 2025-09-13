"use client";
import { useEffect, useState } from "react";
import { useCart } from "@/store/cart";
import Link from "next/link";

export default function CartDrawer() {
  const [open, setOpen] = useState(false);
  const { items, inc, dec, remove, clear, total, count } = useCart();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "c") { e.preventDefault(); setOpen(o => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        className="inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium transition active:scale-95 bg-vu-red text-white hover:opacity-90 h-9"
        onClick={() => setOpen(true)}
      >
        Cart ({count()})
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-[var(--bg)] text-[var(--fg)] border-l border-white/10 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Your Cart</h2>
              <button className="inline-flex items-center justify-center rounded-xl px-3 py-2 border border-white/20" onClick={() => setOpen(false)}>Close</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {items.length === 0 && <p className="opacity-70">Cart is empty.</p>}
              {items.map(it => (
                <div key={it.id} className="flex items-center gap-3 border border-white/10 rounded-xl p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.image} alt={it.name} className="h-16 w-16 rounded-md object-cover" />
                  <div className="flex-1">
                    <div className="font-medium">{it.name}</div>
                    <div className="text-sm opacity-70">Rs {it.price.toLocaleString()}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <button className="px-2 py-1 border border-white/20 rounded" onClick={() => dec(it.id)}>-</button>
                      <span className="w-8 text-center">{it.qty}</span>
                      <button className="px-2 py-1 border border-white/20 rounded" onClick={() => inc(it.id)}>+</button>
                      <button className="ml-3 text-sm text-red-500" onClick={() => remove(it.id)}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4 space-y-3">
              <div className="flex items-center justify-between text-lg">
                <span>Total</span>
                <span className="font-semibold">Rs {total().toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center justify-center rounded-xl px-4 py-2 border border-white/20 flex-1" onClick={clear}>Clear</button>
                <button className="inline-flex items-center justify-center rounded-xl px-4 py-2 bg-vu-red text-white hover:opacity-90 flex-1" onClick={() => alert("Checkout coming soon")}>Checkout</button>
              </div>
              <Link href="/contact" className="block text-center text-sm underline opacity-80">Need help? Contact us</Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
