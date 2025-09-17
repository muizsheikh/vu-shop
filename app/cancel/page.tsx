// /app/cancel/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment Cancelled — Vape Ustad",
  description: "Your Stripe checkout was cancelled.",
  robots: { index: false, follow: false }, // cancel pages ko index na karwayen
};

export default function CancelPage() {
  return (
    <div className="mx-auto max-w-lg p-6 text-center">
      <div className="mx-auto mb-4 h-12 w-12 rounded-full border border-red-500/40 bg-red-500/10" />
      <h1 className="mb-2 text-2xl font-bold">Payment Cancelled</h1>
      <p className="mb-6 opacity-80">
        Aapne Stripe checkout cancel kar diya hai. Aap cart par wapas ja kar dobara
        try kar sakte hain ya koi doosra payment method choose karein.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/checkout"
          className="inline-flex items-center justify-center rounded-xl bg-vu-red px-6 py-3 font-semibold text-white transition hover:opacity-90 active:scale-95"
        >
          Try Again (Checkout)
        </Link>

        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl border border-white/20 px-6 py-3 font-semibold hover:bg-white/5 active:scale-95"
        >
          Continue Shopping
        </Link>
      </div>

      <p className="mt-6 text-sm opacity-70">
        Agar masla barqarar rahe, to{" "}
        <Link href="/contact" className="underline">
          contact page
        </Link>{" "}
        se hamein bata dein.
      </p>
    </div>
  );
}
