"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCartStore } from "@/store/cart";

type ApiError = {
  error?: string;
};

type FormErrors = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
};

const CUSTOMER_INFO_KEY = "vu_checkout_customer_info";

function formatPKR(value: number) {
  return new Intl.NumberFormat("en-PK").format(Number(value || 0));
}

function emailOk(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizePkPhone(value: string) {
  const raw = value.replace(/[^\d+]/g, "").trim();

  if (!raw) return "";

  if (raw.startsWith("+92")) {
    const digits = raw.slice(3).replace(/\D/g, "");
    return `+92${digits}`;
  }

  if (raw.startsWith("92")) {
    const digits = raw.slice(2).replace(/\D/g, "");
    return `+92${digits}`;
  }

  const digits = raw.replace(/\D/g, "");

  if (digits.startsWith("0")) {
    return digits;
  }

  if (digits.startsWith("3")) {
    return `0${digits}`;
  }

  return digits;
}

function isValidPkPhone(value: string) {
  const v = normalizePkPhone(value);
  return /^03\d{9}$/.test(v) || /^\+923\d{9}$/.test(v);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clear } = useCartStore();

  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

  const [errors, setErrors] = useState<FormErrors>({});

  const cartEmpty = items.length === 0;

  const totalValue = useMemo(() => Number(total() || 0), [total]);
  const totalPKR = useMemo(() => formatPKR(totalValue), [totalValue]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_INFO_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw);

      setName(saved?.name || "");
      setEmail(saved?.email || "");
      setPhone(saved?.phone || "");
      setAddress(saved?.address || "");
      setCity(saved?.city || "");
    } catch {
      // ignore localStorage parse issues
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        CUSTOMER_INFO_KEY,
        JSON.stringify({
          name,
          email,
          phone,
          address,
          city,
        })
      );
    } catch {
      // ignore localStorage write issues
    }
  }, [name, email, phone, address, city]);

  const validate = () => {
    const nextErrors: FormErrors = {};

    if (cartEmpty) {
      toast.error("Cart is empty");
      return false;
    }

    if (!name.trim()) {
      nextErrors.name = "Full name is required";
    }

    if (!email.trim()) {
      nextErrors.email = "Email is required";
    } else if (!emailOk(email)) {
      nextErrors.email = "Enter a valid email address";
    }

    if (!phone.trim()) {
      nextErrors.phone = "Phone number is required";
    } else if (!isValidPkPhone(phone)) {
      nextErrors.phone = "Enter a valid Pakistan mobile number";
    }

    if (!address.trim()) {
      nextErrors.address = "Address is required";
    }

    if (!city.trim()) {
      nextErrors.city = "City is required";
    }

    setErrors(nextErrors);

    const firstError = Object.values(nextErrors)[0];
    if (firstError) {
      toast.error(firstError);
      return false;
    }

    return true;
  };

  const handleCOD = async () => {
    if (!validate()) return;

    setLoading(true);

    try {
      const normalizedPhone = normalizePkPhone(phone);

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
          phone: normalizedPhone,
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
      toast.success(
        `Order placed successfully — ${data.so || "Sales Order created"}`
      );

      router.push(
        `/success?method=cod${
          data.so ? `&so=${encodeURIComponent(data.so)}` : ""
        }`
      );
    } catch (error) {
      console.error("COD checkout failed:", error);
      toast.error("COD order failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (hasError?: string) =>
    `w-full rounded-2xl border bg-white px-4 py-3.5 text-[15px] text-neutral-900 outline-none transition placeholder:text-neutral-400 ${
      hasError
        ? "border-red-300 ring-2 ring-red-100"
        : "border-neutral-200 focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100"
    }`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950 md:text-4xl">
          Checkout
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 md:text-base">
          Complete your order with a smooth and secure checkout experience.
          Cash on Delivery is currently active for this order.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.06)] md:p-7">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
              Checkout
            </span>
            <span className="text-sm text-neutral-500">
              Payment method:{" "}
              <span className="font-semibold text-neutral-900">
                Cash on Delivery
              </span>
            </span>
          </div>

          <div className="mb-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-3 text-sm font-semibold text-neutral-900">
              Payment Options
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-neutral-900">
                  Cash on Delivery
                </div>
                <div className="mt-1 text-sm text-neutral-600">
                  Active now. Pay when your order arrives.
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-4 opacity-70">
                <div className="text-sm font-semibold text-neutral-900">
                  Card Payment
                </div>
                <div className="mt-1 text-sm text-neutral-600">
                  Available in the next upgrade phase.
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-bold text-neutral-950">
              Customer Details
            </h2>

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  Full Name
                </label>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) {
                      setErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  placeholder="Enter your full name"
                  className={inputClass(errors.name)}
                />
                {errors.name ? (
                  <p className="mt-2 text-sm text-red-600">{errors.name}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  Email Address
                </label>
                <input
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) {
                      setErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  placeholder="you@example.com"
                  type="email"
                  className={inputClass(errors.email)}
                />
                {errors.email ? (
                  <p className="mt-2 text-sm text-red-600">{errors.email}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  Phone Number
                </label>
                <input
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (errors.phone) {
                      setErrors((prev) => ({ ...prev, phone: undefined }));
                    }
                  }}
                  placeholder="03XX1234567"
                  inputMode="tel"
                  className={inputClass(errors.phone)}
                />
                <p className="mt-2 text-xs text-neutral-500">
                  Pakistan mobile format: 03XX1234567 or +923XX1234567
                </p>
                {errors.phone ? (
                  <p className="mt-2 text-sm text-red-600">{errors.phone}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  Address
                </label>
                <input
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    if (errors.address) {
                      setErrors((prev) => ({ ...prev, address: undefined }));
                    }
                  }}
                  placeholder="House no, street, area"
                  className={inputClass(errors.address)}
                />
                {errors.address ? (
                  <p className="mt-2 text-sm text-red-600">{errors.address}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  City
                </label>
                <input
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    if (errors.city) {
                      setErrors((prev) => ({ ...prev, city: undefined }));
                    }
                  }}
                  placeholder="Enter your city"
                  className={inputClass(errors.city)}
                />
                {errors.city ? (
                  <p className="mt-2 text-sm text-red-600">{errors.city}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <div className="text-sm font-semibold text-neutral-900">
                Secure Order Flow
              </div>
              <div className="mt-1 text-sm text-neutral-600">
                Smooth checkout with safe order creation.
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <div className="text-sm font-semibold text-neutral-900">
                Cash on Delivery
              </div>
              <div className="mt-1 text-sm text-neutral-600">
                Convenient payment on delivery.
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <div className="text-sm font-semibold text-neutral-900">
                Saved Details
              </div>
              <div className="mt-1 text-sm text-neutral-600">
                Your checkout info is auto-filled next time.
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.06)] md:p-6 lg:sticky lg:top-24">
          <h2 className="mb-4 text-xl font-bold text-neutral-950">
            Order Summary
          </h2>

          {cartEmpty ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Your cart is empty — add products before checkout.
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 border-b border-neutral-200 pb-4"
                  >
                    <div className="h-16 w-16 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image || "/images/placeholder.png"}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 font-semibold text-neutral-900">
                        {item.name}
                      </div>
                      <div className="mt-1 text-sm text-neutral-500">
                        Qty: {item.qty}
                      </div>
                    </div>

                    <div className="text-right font-semibold text-neutral-900">
                      Rs {formatPKR(item.price * item.qty)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-center justify-between text-sm text-neutral-600">
                  <span>Subtotal</span>
                  <span>Rs {totalPKR}</span>
                </div>

                <div className="flex items-center justify-between text-sm text-neutral-600">
                  <span>Delivery</span>
                  <span>Calculated after confirmation</span>
                </div>

                <div className="border-t border-neutral-200 pt-3">
                  <div className="flex items-center justify-between text-lg font-bold text-neutral-950">
                    <span>Total</span>
                    <span>Rs {totalPKR}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCOD}
                disabled={loading || cartEmpty}
                className="mt-5 inline-flex min-h-[54px] w-full items-center justify-center rounded-2xl bg-[#a30105] px-6 py-3 text-base font-semibold text-white shadow-[0_10px_30px_rgba(163,1,5,0.2)] transition hover:bg-[#8e0104] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Placing order..." : "Place Cash on Delivery Order"}
              </button>

              <p className="mt-3 text-center text-xs leading-5 text-neutral-500">
                By placing this order, you confirm your contact and delivery
                details are correct.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}