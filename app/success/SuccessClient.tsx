"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  CreditCard,
  FileText,
  Headphones,
  House,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
  UserRound,
} from "lucide-react";

const DEFAULT_WHATSAPP_NUMBER = "923015554249";
const DEFAULT_SUPPORT_EMAIL = "info@vapeustad.com";

type PublicSettings = {
  store_name?: string;
  support_email?: string;
  whatsapp_number?: string;
};

function cleanWhatsAppNumber(value: string) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function SuccessInner() {
  const params = useSearchParams();
  const method = (params.get("method") || "").toLowerCase();
  const so = params.get("so") || "";

  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadSettings() {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const json = await res.json().catch(() => null);

        if (!alive || !res.ok) return;

        setSettings(json?.settings || json || null);
      } catch {
        // Public settings are optional on the success page.
      }
    }

    loadSettings();

    return () => {
      alive = false;
    };
  }, []);

  const isCOD = method === "cod";
  const supportEmail = String(settings?.support_email || DEFAULT_SUPPORT_EMAIL).trim();
  const whatsappNumber = cleanWhatsAppNumber(
    String(settings?.whatsapp_number || DEFAULT_WHATSAPP_NUMBER)
  );

  const whatsappUrl = useMemo(() => {
    const whatsappMessage = encodeURIComponent(
      `Hello Vape Ustad, my order has been placed successfully${
        so ? `.\nSales Order: ${so}` : ""
      }.\nI need help with this order.`
    );

    return `https://wa.me/${whatsappNumber || DEFAULT_WHATSAPP_NUMBER}?text=${whatsappMessage}`;
  }, [so, whatsappNumber]);

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-10 md:px-6 md:py-14">
      <div className="relative overflow-hidden rounded-[34px] border border-black/10 bg-[#fefefe] shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[340px] w-[340px] -translate-x-1/2 rounded-full bg-emerald-500/[0.08] blur-3xl" />
          <div className="absolute -left-14 bottom-8 h-40 w-40 rounded-full bg-black/[0.035] blur-3xl" />
          <div className="absolute -right-14 top-10 h-48 w-48 rounded-full bg-emerald-400/[0.05] blur-3xl" />

          <div className="absolute right-10 top-10 hidden opacity-[0.03] md:block">
            <div className="relative h-28 w-28">
              <Image
                src="/images/vu-age-watermark.png"
                alt="Vape Ustad watermark"
                fill
                className="object-contain"
              />
            </div>
          </div>
        </div>

        <div className="relative border-b border-black/8 bg-gradient-to-b from-[#f6fffb] via-[#fbfffd] to-[#fefefe] px-6 py-12 md:px-10 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/15 shadow-[0_14px_40px_rgba(16,185,129,0.12)]">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>

            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Order Confirmed
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black md:text-4xl">
              Thank you. Your order has been received.
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-black/65 md:text-base">
              {isCOD
                ? "Your Cash on Delivery order has been placed successfully. Our team will review and process it soon."
                : "Your order has been placed successfully and has been received by our team."}
            </p>

            {so ? (
              <div className="mt-7 inline-flex flex-wrap items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-black shadow-[0_8px_24px_rgba(16,185,129,0.05)]">
                <span className="text-black/60">Sales Order</span>
                <span className="mx-2 text-black/25">•</span>
                <span className="text-emerald-700">{so}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative px-6 py-7 md:px-10 md:py-9">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-black/8 bg-black/[0.02] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <PackageCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="text-sm font-semibold text-black">
                  Order Status
                </div>
              </div>
              <div className="mt-3 text-sm leading-6 text-black/65">
                Order placed successfully and saved in your account order history.
              </div>
            </div>

            <div className="rounded-2xl border border-black/8 bg-black/[0.02] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <CreditCard className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="text-sm font-semibold text-black">
                  Payment Method
                </div>
              </div>
              <div className="mt-3 text-sm leading-6 text-black/65">
                {isCOD ? "Cash on Delivery" : "Order received successfully"}
              </div>
            </div>

            <div className="rounded-2xl border border-black/8 bg-black/[0.02] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Headphones className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="text-sm font-semibold text-black">
                  Support
                </div>
              </div>
              <div className="mt-3 text-sm leading-6 text-black/65">
                Need help? Contact us through WhatsApp or email at {supportEmail}.
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-[#f8fffc] p-5 shadow-[0_8px_24px_rgba(16,185,129,0.04)]">
            <div className="flex gap-3">
              <FileText className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
              <p className="text-sm leading-7 text-black/70">
                Please keep your phone available. For Cash on Delivery orders,
                our team may contact you to confirm order details before final processing.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/account"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#a30105] px-6 py-3 font-semibold text-white shadow-[0_12px_30px_rgba(163,1,5,0.18)] transition duration-200 hover:-translate-y-[1px] hover:bg-[#8e0104]"
            >
              <UserRound className="h-4 w-4" />
              My Orders
            </Link>

            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-6 py-3 font-semibold text-black transition duration-200 hover:bg-black/[0.03]"
            >
              <ShoppingBag className="h-4 w-4" />
              Continue Shopping
            </Link>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-3 font-semibold text-emerald-700 transition duration-200 hover:bg-emerald-100"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-6 py-3 font-semibold text-black transition duration-200 hover:bg-black/[0.03]"
            >
              <House className="h-4 w-4" />
              Home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SuccessClient() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-sm text-black/60">
          Loading...
        </div>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
