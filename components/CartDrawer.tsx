"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/cart";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName.toLowerCase();

  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

function formatPKR(value: number) {
  return new Intl.NumberFormat("en-PK").format(Number(value || 0));
}

export default function CartDrawer() {
  const [open, setOpen] = useState(false);
  const { items, inc, dec, remove, clear, total, count } = useCartStore();

  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const cartCount = ready ? count() : 0;
  const cartTotal = useMemo(() => Number(total() || 0), [total]);
  const cartEmpty = items.length === 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#a30105]/15 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-900 shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition hover:bg-[#fff7f7] hover:border-[#a30105]/25 active:scale-[0.98]"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#a30105]/10 text-[#a30105]">
          <ShoppingCart className="h-4.5 w-4.5" />
        </span>
        <span>Cart</span>
        <span className="inline-flex min-w-[26px] items-center justify-center rounded-full bg-[#a30105] px-2 py-0.5 text-xs font-bold text-white">
          {cartCount}
        </span>
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-neutral-50 text-neutral-900 shadow-[-20px_0_60px_rgba(0,0,0,0.12)]">
            <div className="border-b border-neutral-200 bg-white px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-neutral-950">
                    Your Cart
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {cartEmpty
                      ? "No items added yet"
                      : `${cartCount} item${cartCount > 1 ? "s" : ""} in your cart`}
                  </p>
                </div>

                <button
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {cartEmpty ? (
                <div className="flex h-full flex-col items-center justify-center rounded-[28px] border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-2xl">
                    🛒
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-neutral-950">
                    Your cart is empty
                  </h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-neutral-500">
                    Add your favorite products to continue with checkout.
                  </p>

                  <Link
                    href="/products"
                    onClick={() => setOpen(false)}
                    className="mt-5 inline-flex min-h-[46px] items-center justify-center rounded-2xl border border-[#a30105]/15 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition hover:bg-[#fff7f7] hover:border-[#a30105]/25"
                  >
                    Continue Shopping
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className="rounded-[24px] border border-neutral-200 bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.04)]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={it.image || "/images/placeholder.png"}
                            alt={it.name}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-sm font-semibold text-neutral-900">
                            {it.name}
                          </div>

                          <div className="mt-1 text-sm text-neutral-500">
                            Rs {formatPKR(it.price)} each
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="inline-flex items-center rounded-2xl border border-neutral-200 bg-neutral-50 p-1">
                              <button
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-lg font-medium text-neutral-700 transition hover:bg-white"
                                onClick={() => dec(it.id)}
                                aria-label="Decrease"
                              >
                                −
                              </button>

                              <span className="inline-flex min-w-[36px] items-center justify-center text-sm font-semibold text-neutral-900">
                                {it.qty}
                              </span>

                              <button
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-lg font-medium text-neutral-700 transition hover:bg-white"
                                onClick={() => inc(it.id)}
                                aria-label="Increase"
                              >
                                +
                              </button>
                            </div>

                            <div className="text-right">
                              <div className="text-sm font-bold text-neutral-950">
                                Rs {formatPKR(it.price * it.qty)}
                              </div>
                              <button
                                className="mt-1 text-xs font-medium text-red-600 transition hover:text-red-700"
                                onClick={() => remove(it.id)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-neutral-200 bg-white px-4 py-4 sm:px-5">
              <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-center justify-between text-sm text-neutral-600">
                  <span>Subtotal</span>
                  <span>Rs {formatPKR(cartTotal)}</span>
                </div>

                <div className="mt-2 flex items-center justify-between text-sm text-neutral-600">
                  <span>Delivery</span>
                  <span>Calculated at checkout</span>
                </div>

                <div className="mt-3 border-t border-neutral-200 pt-3">
                  <div className="flex items-center justify-between text-lg font-bold text-neutral-950">
                    <span>Total</span>
                    <span>Rs {formatPKR(cartTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={clear}
                  disabled={cartEmpty}
                  className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear Cart
                </button>

                <Link
                  href="/checkout"
                  onClick={() => setOpen(false)}
                  className={`inline-flex min-h-[48px] flex-1 items-center justify-center rounded-2xl px-4 py-3 text-center text-sm font-semibold transition ${
                    cartEmpty
                      ? "pointer-events-none bg-neutral-300 text-white"
                      : "border border-[#a30105]/15 bg-white text-neutral-900 shadow-[0_8px_24px_rgba(0,0,0,0.04)] hover:bg-[#fff7f7] hover:border-[#a30105]/25"
                  }`}
                >
                  Checkout
                </Link>
              </div>

              <div className="mt-4 grid gap-2">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                  Fast checkout, clean order summary, and COD support.
                </div>

                <Link
                  href="/contact"
                  onClick={() => setOpen(false)}
                  className="text-center text-sm font-medium text-neutral-600 underline-offset-4 transition hover:text-neutral-900 hover:underline"
                >
                  Need help? Contact us
                </Link>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}