"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function SuccessInner() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");

  // (Optional) kuch light UX polish: top par scroll, etc.
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h1 className="text-3xl font-bold text-vu-red">Payment Successful 🎉</h1>

      <p className="mt-4 text-lg opacity-80">
        Shukriya! Aapka order receive ho gaya hai.
        <br />
        Hum aapko email par confirmation bhej chukay hain.
      </p>

      {sessionId && (
        <p className="mt-3 text-sm opacity-60">
          Session ID: <span className="font-mono">{sessionId}</span>
        </p>
      )}

      <div className="mt-8 flex items-center justify-center gap-3">
        <Link
          href="/products"
          className="rounded-lg bg-vu-red px-4 py-2 text-white transition hover:opacity-90"
        >
          Continue Shopping
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-black/10 px-4 py-2 text-sm transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
        >
          Back to Home
        </Link>
      </div>

      <div className="mt-6 text-xs opacity-60">
        Agar koi masla ho, to{" "}
        <Link href="/contact" className="underline">
          Contact
        </Link>{" "}
        par message chhor dein.
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center">Loading…</div>}>
      <SuccessInner />
    </Suspense>
  );
}
