"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CreditCard, FileText, Headphones, House, ShoppingBag } from "lucide-react";

function SuccessInner() {
  const params = useSearchParams();
  const method = (params.get("method") || "").toLowerCase();
  const so = params.get("so") || "";

  const isCOD = method === "cod";

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 md:px-6 md:py-16">
      <div className="overflow-hidden rounded-[32px] border border-black/10 bg-[#fefefe] shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
        <div className="relative border-b border-black/8 bg-gradient-to-b from-[#fff7f7] to-[#fefefe] px-6 py-10 md:px-10 md:py-12">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#a30105]/[0.05] blur-3xl" />
          <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-black/[0.04] blur-3xl" />

          <div className="relative text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#a30105]/10 ring-1 ring-[#a30105]/10">
              <CheckCircle2 className="h-10 w-10 text-[#a30105]" />
            </div>

            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#a30105]">
              Order Confirmed
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black md:text-4xl">
              Thank you. Your order has been received.
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-black/65 md:text-base">
              {isCOD
                ? "Your Cash on Delivery order has been placed successfully and saved in our ERP system for manual review."
                : "Your order has been placed successfully and has been received by our team."}
            </p>

            {so ? (
              <div className="mt-6 inline-flex items-center rounded-2xl border border-[#a30105]/15 bg-[#a30105]/[0.05] px-4 py-3 text-sm font-semibold text-black">
                <span className="text-black/60">Sales Order</span>
                <span className="mx-2 text-black/25">•</span>
                <span className="text-[#a30105]">{so}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="px-6 py-6 md:px-10 md:py-8">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-black/8 bg-black/[0.02] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#a30105]/8">
                  <FileText className="h-5 w-5 text-[#a30105]" />
                </div>
                <div className="text-sm font-semibold text-black">Order Status</div>
              </div>
              <div className="mt-3 text-sm leading-6 text-black/65">
                Draft in ERP for review and processing by our team.
              </div>
            </div>

            <div className="rounded-2xl border border-black/8 bg-black/[0.02] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#a30105]/8">
                  <CreditCard className="h-5 w-5 text-[#a30105]" />
                </div>
                <div className="text-sm font-semibold text-black">Payment Method</div>
              </div>
              <div className="mt-3 text-sm leading-6 text-black/65">
                {isCOD ? "Cash on Delivery" : "Order received successfully"}
              </div>
            </div>

            <div className="rounded-2xl border border-black/8 bg-black/[0.02] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#a30105]/8">
                  <Headphones className="h-5 w-5 text-[#a30105]" />
                </div>
                <div className="text-sm font-semibold text-black">Next Step</div>
              </div>
              <div className="mt-3 text-sm leading-6 text-black/65">
                Our team will review your order and contact you if anything is needed.
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[#a30105]/12 bg-[#a30105]/[0.04] p-5">
            <p className="text-sm leading-7 text-black/70">
              Please keep your phone available after placing the order. For Cash on Delivery,
              our team may confirm order details before final processing.
            </p>
          </div>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#a30105] px-6 py-3 font-semibold text-white shadow-[0_12px_30px_rgba(163,1,5,0.18)] transition duration-200 hover:-translate-y-[1px] hover:bg-[#8e0104]"
            >
              <ShoppingBag className="h-4 w-4" />
              Continue Shopping
            </Link>

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-6 py-3 font-semibold text-black transition duration-200 hover:bg-black/[0.03]"
            >
              <House className="h-4 w-4" />
              Back to Home
            </Link>

            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-6 py-3 font-semibold text-black transition duration-200 hover:bg-black/[0.03]"
            >
              <Headphones className="h-4 w-4" />
              Need Help?
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SuccessPage() {
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