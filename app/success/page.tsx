"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SuccessInner() {
  const params = useSearchParams();
  const method = (params.get("method") || "").toLowerCase();
  const so = params.get("so") || "";

  const isCOD = method === "cod";

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl text-emerald-400">
          ✓
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Order placed successfully
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/70 md:text-lg">
            {isCOD
              ? "Your Cash on Delivery order has been received successfully and saved in our ERP system for review."
              : "Your order has been received successfully."}
          </p>

          {so ? (
            <div className="mt-6 inline-flex items-center rounded-2xl border border-vu-red/30 bg-vu-red/10 px-4 py-3 text-sm font-semibold text-white">
              Sales Order: <span className="ml-2 text-vu-red">{so}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm font-semibold text-white">Order Status</div>
            <div className="mt-2 text-sm leading-6 text-white/70">
              Draft in ERP for manual review.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm font-semibold text-white">Payment Method</div>
            <div className="mt-2 text-sm leading-6 text-white/70">
              {isCOD ? "Cash on Delivery" : "Order Received"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm font-semibold text-white">Next Step</div>
            <div className="mt-2 text-sm leading-6 text-white/70">
              Our team will review the order and contact you if needed.
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded-2xl bg-vu-red px-6 py-3 font-semibold text-white transition hover:opacity-90 active:scale-[0.99]"
          >
            Continue Shopping
          </Link>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10 active:scale-[0.99]"
          >
            Back to Home
          </Link>

          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10 active:scale-[0.99]"
          >
            Need Help?
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-white/70">Loading…</div>}>
      <SuccessInner />
    </Suspense>
  );
}