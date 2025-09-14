// /components/CheckoutButton.tsx
"use client";

import { useState } from "react";
import { useCartStore } from "@/store/cart";

export default function CheckoutButton() {
  const items = useCartStore((s) => s.items);
  const [loading, setLoading] = useState(false);

  async function checkout() {
    if (!items.length) return alert("Cart is empty.");

    setLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

      // Stripe-ready payload
      const line_items = items.map((it) => ({
        price_data: {
          currency: "pkr",
          product_data: {
            name: it.name,
            images:
              it.image && baseUrl
                ? [`${baseUrl}${it.image}`] // ✅ prepend base URL
                : [],
          },
          unit_amount: Math.round(it.price * 100), // PKR → paisa
        },
        quantity: it.qty,
      }));

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_items }),
      });

      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url; // redirect to Stripe
      } else {
        alert("Checkout failed. Please try again.");
        console.error("Checkout error:", data);
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
