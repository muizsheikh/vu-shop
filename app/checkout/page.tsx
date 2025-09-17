// /app/checkout/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCartStore } from "@/store/cart";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clear } = useCartStore();
  const [loading, setLoading] = useState<null | "stripe" | "cod" | "jc" | "ep">(null);

  // Customer fields (for COD, optional prefill for future)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

  const cartEmpty = items.length === 0;
  const totalPKR = useMemo(
    () => new Intl.NumberFormat("en-PK").format(Number(total() || 0)),
    [total]
  );

  // ---- Stripe (Card Payment) ----
  const handleStripe = async () => {
    if (cartEmpty) return toast.error("Cart is empty");
    setLoading("stripe");
    try {
      const line_items = items.map((it) => ({
        price_data: {
          currency: "pkr",
          product_data: { name: it.name },
          unit_amount: Math.round(Number(it.price) * 100),
        },
        quantity: it.qty,
      }));

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_items }),
      });

      const data = await res.json();
      if (res.ok && data?.url) {
        toast.success("Redirecting to secure payment…");
        window.location.href = data.url as string;
      } else {
        toast.error(data?.error || "Stripe checkout failed");
      }
    } catch (e) {
      console.error(e);
      toast.error("Stripe error");
    } finally {
      setLoading(null);
    }
  };

  // ---- COD (ERPNext SO + email + Shipping Address) ----
  const handleCOD = async () => {
    if (cartEmpty) return toast.error("Cart is empty");

    // basic validation
    if (!name.trim()) return toast.error("Name is required");
    if (!email.trim()) return toast.error("Email is required");
    if (!phone.trim()) return toast.error("Phone is required");
    if (!address.trim()) return toast.error("Address is required");
    if (!city.trim()) return toast.error("City is required");

    setLoading("cod");
    try {
      const res = await fetch("/api/cod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          customer: {
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            address_line1: address.trim(),
            city: city.trim(),
            country: "Pakistan",
          },
        }),
      });
      const data = await res.json();

      if (res.ok) {
        clear();
        toast.success(`Order placed (COD) — ${data.so}`);
        router.push("/success");
      } else {
        toast.error(data?.error || "COD order failed");
      }
    } catch (e) {
      console.error(e);
      toast.error("COD error");
    } finally {
      setLoading(null);
    }
  };

  const comingSoon = (method: "JazzCash" | "Easypaisa") => {
    toast(`${method} is coming soon`, { description: "We’re wiring up the gateway." });
  };

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-2 text-2xl font-bold">Choose Payment Method</h1>
      <p className="mb-6 opacity-80">
        Total: <span className="font-semibold">Rs {totalPKR}</span>
      </p>

      {/* Customer info (used for COD now, can prefill Stripe later) */}
      <div className="mb-6 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="w-full rounded-xl border border-white/20 bg-transparent px-4 py-3 outline-none"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          className="w-full rounded-xl border border-white/20 bg-transparent px-4 py-3 outline-none"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          className="w-full rounded-xl border border-white/20 bg-transparent px-4 py-3 outline-none"
        />
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address line 1"
          className="w-full rounded-xl border border-white/20 bg-transparent px-4 py-3 outline-none"
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          className="w-full rounded-xl border border-white/20 bg-transparent px-4 py-3 outline-none"
        />
      </div>

      <div className="space-y-3">
        <button
          onClick={handleStripe}
          disabled={loading !== null}
          className="w-full rounded-xl bg-vu-red px-6 py-3 font-semibold text-white transition hover:opacity-90 active:scale-95 disabled:opacity-60"
        >
          {loading === "stripe" ? "Redirecting…" : "Card Payment (Stripe)"}
        </button>

        <button
          onClick={handleCOD}
          disabled={loading !== null}
          className="w-full rounded-xl border border-white/20 px-6 py-3 font-semibold hover:bg-white/5 active:scale-95 disabled:opacity-60"
        >
          {loading === "cod" ? "Placing order…" : "Cash on Delivery"}
        </button>

        <button
          onClick={() => {
            comingSoon("JazzCash");
          }}
          disabled={loading !== null}
          className="w-full rounded-xl border border-white/20 px-6 py-3 font-semibold hover:bg-white/5 active:scale-95 disabled:opacity-60"
        >
          JazzCash (Coming Soon)
        </button>

        <button
          onClick={() => {
            comingSoon("Easypaisa");
          }}
          disabled={loading !== null}
          className="w-full rounded-xl border border-white/20 px-6 py-3 font-semibold hover:bg-white/5 active:scale-95 disabled:opacity-60"
        >
          Easypaisa (Coming Soon)
        </button>
      </div>

      {cartEmpty && (
        <p className="mt-4 text-sm text-amber-400">
          Your cart is empty — add items before checking out.
        </p>
      )}
    </div>
  );
}
