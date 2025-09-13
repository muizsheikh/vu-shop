"use client";

import { useState } from "react";
import { useCart } from "@/store/cart";

export default function CheckoutButton() {
  const items = useCart((s) => s.items);
  const [loading, setLoading] = useState(false);

  async function checkout() {
    if (!items.length) return alert("Cart is empty.");

    setLoading(true);
    try {
      // CartItem -> API payload
      const toSend = items.map(({ slug, name, price, image, qty }) => ({
        slug,
        name,
        price,
        image,
        qty,
      }));

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: toSend }),
      });

      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url; // Stripe Checkout
      } else {
        alert("Checkout failed. Please try again.");
        console.error(data);
      }
    } catch (e) {
      alert("Checkout error. See console.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={checkout}
      disabled={loading || items.length === 0}
      className="inline-flex items-center justify-center rounded-xl px-4 py-2 bg-vu-red text-white hover:opacity-90 flex-1 disabled:opacity-50"
    >
      {loading ? "Redirecting…" : "Checkout"}
    </button>
  );
}
