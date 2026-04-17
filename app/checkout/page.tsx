"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCartStore } from "@/store/cart";

type ApiError = {
  error?: string;
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clear } = useCartStore();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

  const cartEmpty = items.length === 0;

  const totalValue = useMemo(() => Number(total() || 0), [total]);
  const totalPKR = useMemo(
    () => new Intl.NumberFormat("en-PK").format(totalValue),
    [totalValue]
  );

  const emailOk = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const formatPKR = (value: number) =>
    new Intl.NumberFormat("en-PK").format(Number(value || 0));

  const validate = () => {
    if (cartEmpty) {
      toast.error("Cart is empty");
      return false;
    }
    if (!name.trim()) {
      toast.error("Name is required");
      return false;
    }
    if (!email.trim()) {
      toast.error("Email is required");
      return false;
    }
    if (!emailOk(email)) {
      toast.error("Valid email required");
      return false;
    }
    if (!phone.trim()) {
      toast.error("Phone is required");
      return false;
    }
    if (!address.trim()) {
      toast.error("Address is required");
      return false;
    }
    if (!city.trim()) {
      toast.error("City is required");
      return false;
    }
    return true;
  };

  const handleCOD = async () => {
    if (!validate()) return;

    setLoading(true);

    try {
      const payload = {
        items: items.map((it) => ({
          item_code: it.id,
          name: it.name,
          qty: it.qty,
          price: it.price,
        })),
        customer: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address_line1: address.trim(),
          city: city.trim(),
          country: "Pakistan",
        },
      };

      const res = await fetch("/api/cod", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data: ApiError & { success?: boolean; so?: string } = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        toast.error(data?.error || "COD order failed");
        return;
      }

      clear();
      toast.success(`Order placed successfully — ${data.so || "Sales Order created"}`);
      router.push(`/success?method=cod${data.so ? `&so=${encodeURIComponent(data.so)}` : ""}`);
    } catch (error) {
      console.error("COD checkout failed:", error);
      toast.error("COD order failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-2xl font-bold">Checkout</h1>
      <p className="mb-6 opacity-80">
        Payment method: <span className="font-semibold">Cash on Delivery</span>
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-4 text-lg font-semibold">Customer Details</h2>

          <div className="space-y-3">
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
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>

          {cartEmpty ? (
            <p className="text-sm text-amber-400">
              Your cart is empty — add items before checking out.
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 border-b border-white/10 pb-3"
                  >
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm opacity-70">
                        Qty: {item.qty}
                      </div>
                    </div>

                    <div className="text-right font-medium">
                      Rs {formatPKR(item.price * item.qty)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between text-lg font-semibold">
                <span>Total</span>
                <span>Rs {totalPKR}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={handleCOD}
          disabled={loading || cartEmpty}
          className="w-full rounded-xl bg-vu-red px-6 py-3 font-semibold text-white transition hover:opacity-90 active:scale-95 disabled:opacity-60"
        >
          {loading ? "Placing order..." : "Place Cash on Delivery Order"}
        </button>
      </div>
    </div>
  );
}