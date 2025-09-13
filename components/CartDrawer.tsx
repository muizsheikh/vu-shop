// /components/CartDrawer.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/store/cart";
import CheckoutButton from "./CheckoutButton";

export default function CartDrawer() {
  const [open, setOpen] = useState(false);
  const { items, inc, dec, remove, clear, total, count } = useCart();

  // Keyboard shortcut: press "c" to toggle cart
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Trigger in navbar/header */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center justify-center rounded-xl bg-vu-red px-4 py-2 font-medium text-white transition hover:opacity-90 active:scale-95"
      >
        Cart ({count()})
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />

          {/* Drawer */}
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[var(--bg)] p-4 text-[var(--fg)]">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your Cart</h2>
              <button
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-xl border border-white/20 px-3 py-2"
              >
                Close
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 space-y-3 overflow-y-auto">
              {items.length === 0 && <p className="opacity-70">Cart is empty.</p>}

              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 p-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.image}
                    alt={it.name}
                    className="h-16 w-16 rounded-md object-cover"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{it.name}</div>
                    <div className="text-sm opacity-70">
                      Rs {Number(it.price).toLocaleString()}
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        className="rounded border border-white/20 px-2 py-1"
                        onClick={() => dec(it.id)}
                        aria-label="Decrease"
                      >
                        -
                      </button>
                      <span className="w-8 text-center">{it.qty}</span>
                      <button
                        className="rounded border border-white/20 px-2 py-1"
                        onClick={() => inc(it.id)}
                        aria-label="Increase"
                      >
                        +
                      </button>

                      <button
                        className="ml-3 text-sm text-red-500"
                        onClick={() => remove(it.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between text-lg">
                <span>Total</span>
                <span className="font-semibold">
                  Rs {Number(total()).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={clear}
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/20 px-4 py-2"
                >
                  Clear
                </button>

                {/* Stripe checkout */}
                <CheckoutButton />
              </div>

              <Link
                href="/contact"
                className="block text-center text-sm underline opacity-80"
              >
                Need help? Contact us
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
