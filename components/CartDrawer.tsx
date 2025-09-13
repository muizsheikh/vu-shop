"use client";

import { useCart } from "@/store/cart";
import { useState } from "react";

export default function CartDrawer() {
  const items = useCart((s) => s.items);
  const total = useCart((s) => s.total);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);

  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    try {
      setLoading(true);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Checkout failed");
      }

      const { url } = await res.json();
      if (!url) throw new Error("No session URL returned.");

      window.location.href = url;
    } catch (err: any) {
      console.error("Checkout error:", err);
      alert("❌ " + (err.message || "Unable to checkout"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <h2 className="font-bold text-lg">Your Cart</h2>

      <ul className="flex flex-col gap-2">
        {items.map((it) => (
          <li key={it.slug} className="flex justify-between">
            <span>
              {it.name} × {it.qty}
            </span>
            <span>Rs {it.price * it.qty}</span>
            <button
              className="text-red-500 text-sm"
              onClick={() => remove(it.slug)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="flex justify-between font-bold pt-2">
        <span>Total:</span>
        <span>Rs {total}</span>
      </div>

      <button
        onClick={handleCheckout}
        disabled={loading || items.length === 0}
        className="w-full py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? "Processing…" : "Checkout"}
      </button>

      <button
        onClick={clear}
        className="w-full py-2 border rounded-md text-gray-700 hover:bg-gray-100"
      >
        Clear Cart
      </button>
    </div>
  );
}
