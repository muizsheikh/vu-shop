"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Loader2,
  LockKeyhole,
  PackageCheck,
  ShoppingCart,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useCartStore } from "@/store/cart";
import { supabase } from "@/lib/supabaseClient";

const DELIVERY_CHARGE = 200;

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

type Profile = {
  full_name: string | null;
  phone: string | null;
  city: string | null;
  address_line1: string | null;
};

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

  if (digits.startsWith("0")) return digits;
  if (digits.startsWith("3")) return `0${digits}`;

  return digits;
}

function isValidPkPhone(value: string) {
  const v = normalizePkPhone(value);
  return /^03\d{9}$/.test(v) || /^\+923\d{9}$/.test(v);
}

export default function CheckoutClient() {
  const router = useRouter();
  const { items, total, clear } = useCartStore();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(false);

  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

  const [errors, setErrors] = useState<FormErrors>({});

  const cartEmpty = items.length === 0;

  const subtotalValue = useMemo(() => Number(total() || 0), [total]);
  const deliveryAmount = cartEmpty ? 0 : DELIVERY_CHARGE;
  const grandTotalValue = subtotalValue + deliveryAmount;

  const subtotalPKR = useMemo(
    () => formatPKR(subtotalValue),
    [subtotalValue]
  );
  const deliveryPKR = useMemo(
    () => formatPKR(deliveryAmount),
    [deliveryAmount]
  );
  const grandTotalPKR = useMemo(
    () => formatPKR(grandTotalValue),
    [grandTotalValue]
  );

  const profileIncomplete =
    !name.trim() || !phone.trim() || !address.trim() || !city.trim();

  useEffect(() => {
    async function loadCustomerProfile() {
      setCheckingAuth(true);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        router.replace("/account/login?next=/checkout");
        return;
      }

      setUserId(user.id);
      setEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone, city, address_line1")
        .eq("id", user.id)
        .single();

      const p = profile as Profile | null;

      setName(p?.full_name || "");
      setPhone(p?.phone || "");
      setCity(p?.city || "");
      setAddress(p?.address_line1 || "");

      setCheckingAuth(false);
    }

    loadCustomerProfile();
  }, [router]);

  const validate = () => {
    const nextErrors: FormErrors = {};

    if (cartEmpty) {
      toast.error("Cart is empty");
      return false;
    }

    if (!name.trim()) nextErrors.name = "Full name is required";

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

    if (!address.trim()) nextErrors.address = "Address is required";
    if (!city.trim()) nextErrors.city = "City is required";

    setErrors(nextErrors);

    const firstError = Object.values(nextErrors)[0];
    if (firstError) {
      toast.error(firstError);
      return false;
    }

    return true;
  };

  const saveProfileChanges = async () => {
    if (!userId) return;

    await supabase
      .from("profiles")
      .update({
        full_name: name.trim(),
        phone: normalizePkPhone(phone),
        city: city.trim(),
        address_line1: address.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  };

  const handleCOD = async () => {
    if (loading) return;
    if (!validate()) return;

    setLoading(true);

    try {
      await saveProfileChanges();

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
        delivery_charge: DELIVERY_CHARGE,
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

      await supabase.from("orders").insert({
        user_id: userId,
        sales_order: data.so || null,
        payment_method: "cod",
        status: "placed",
        total_amount: grandTotalValue,
        currency: "PKR",
        customer_name: name.trim(),
        customer_email: email.trim(),
        customer_phone: normalizedPhone,
        city: city.trim(),
        address_line1: address.trim(),
        items: items.map((it) => ({
          id: it.id,
          name: it.name,
          qty: it.qty,
          price: it.price,
          image: it.image || null,
        })),
      });

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

  if (checkingAuth) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <div className="text-lg font-black text-neutral-950">
          Checking account...
        </div>
        <p className="mt-2 text-sm text-neutral-500">
          Checkout account verification is in progress.
        </p>
      </div>
    );
  }

  return (
    <>
      {loading ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/90 px-4 backdrop-blur-md">
          <div className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-neutral-200 bg-[#fefefe] p-7 text-center shadow-[0_24px_90px_rgba(0,0,0,0.18)]">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-0 h-52 w-52 -translate-x-1/2 rounded-full bg-[#a30105]/10 blur-3xl" />
              <div className="absolute -bottom-16 -right-16 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl" />
            </div>

            <div className="relative">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#a30105]/10 text-[#a30105] ring-1 ring-[#a30105]/15">
                <Loader2 className="h-10 w-10 animate-spin" />
              </div>

              <p className="mt-6 text-xs font-black uppercase tracking-[0.24em] text-[#a30105]">
                Secure Checkout
              </p>

              <h2 className="mt-3 text-2xl font-black text-neutral-950">
                Placing your order...
              </h2>

              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-neutral-600">
                Creating your order record, syncing details, and preparing
                confirmation. Please do not close this page.
              </p>

              <div className="mt-6 grid gap-3 text-left">
                <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <PackageCheck className="h-5 w-5 shrink-0 text-[#a30105]" />
                  <span className="text-sm font-semibold text-neutral-800">
                    Creating secure order record
                  </span>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <LockKeyhole className="h-5 w-5 shrink-0 text-[#a30105]" />
                  <span className="text-sm font-semibold text-neutral-800">
                    Saving customer details safely
                  </span>
                </div>
              </div>

              <div className="mt-6 h-2 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-[#a30105]" />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950 md:text-4xl">
            Checkout
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 md:text-base">
            Complete your order with saved account details and Cash on Delivery.
          </p>
        </div>

        <div className="mb-6 rounded-[26px] border border-neutral-200 bg-white p-4 shadow-[0_16px_45px_rgba(0,0,0,0.05)] md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#a30105]/10 text-[#a30105]">
                <UserRound className="h-5 w-5" />
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#a30105]">
                  Logged In Checkout
                </div>
                <div className="mt-1 text-lg font-black text-neutral-950">
                  {name || "Customer"}
                </div>
                <div className="mt-1 text-sm text-neutral-500">{email}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-bold text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Saved account
              </span>

              <Link
                href="/account/profile"
                className="inline-flex items-center gap-2 rounded-2xl border border-[#a30105]/15 bg-white px-4 py-2 text-sm font-bold text-neutral-900 transition hover:bg-[#fff7f7]"
              >
                <Edit3 className="h-4 w-4 text-[#a30105]" />
                Edit Profile
              </Link>
            </div>
          </div>

          {profileIncomplete ? (
            <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="font-bold">Profile details need attention</div>
                <div className="mt-1">
                  Please complete phone, city and address before placing order.
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
              Your saved profile details are loaded below. You can update them
              here and they will be saved for future checkout.
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.06)] md:p-7">
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
                    disabled={loading}
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
                    disabled
                    placeholder="you@example.com"
                    type="email"
                    className="w-full cursor-not-allowed rounded-2xl border border-neutral-200 bg-neutral-100 px-4 py-3.5 text-[15px] text-neutral-500 outline-none"
                  />
                  <p className="mt-2 text-xs text-neutral-500">
                    Email is linked to your account.
                  </p>
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
                    disabled={loading}
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
                        setErrors((prev) => ({
                          ...prev,
                          address: undefined,
                        }));
                      }
                    }}
                    placeholder="House no, street, area"
                    disabled={loading}
                    className={inputClass(errors.address)}
                  />
                  {errors.address ? (
                    <p className="mt-2 text-sm text-red-600">
                      {errors.address}
                    </p>
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
                    disabled={loading}
                    className={inputClass(errors.city)}
                  />
                  {errors.city ? (
                    <p className="mt-2 text-sm text-red-600">{errors.city}</p>
                  ) : null}
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
                    <span>Rs {subtotalPKR}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm text-neutral-600">
                    <span>Delivery Charges</span>
                    <span>Rs {deliveryPKR}</span>
                  </div>

                  <div className="border-t border-neutral-200 pt-3">
                    <div className="flex items-center justify-between text-lg font-bold text-neutral-950">
                      <span>Total</span>
                      <span>Rs {grandTotalPKR}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCOD}
                  disabled={loading || cartEmpty}
                  className="mt-5 inline-flex min-h-[54px] w-full items-center justify-center gap-3 rounded-2xl border border-[#a30105]/15 bg-white px-6 py-3 text-base font-semibold text-neutral-900 shadow-[0_10px_30px_rgba(0,0,0,0.05)] transition hover:border-[#a30105]/25 hover:bg-[#fff7f7] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#a30105]/10 text-[#a30105]">
                    {loading ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    ) : (
                      <ShoppingCart className="h-4.5 w-4.5" />
                    )}
                  </span>
                  <span>
                    {loading
                      ? "Placing your order..."
                      : "Place Cash on Delivery Order"}
                  </span>
                </button>

                <p className="mt-3 text-center text-xs leading-5 text-neutral-500">
                  By placing this order, your saved profile details may be
                  updated.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}