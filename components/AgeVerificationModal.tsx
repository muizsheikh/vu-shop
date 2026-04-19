"use client";

import Image from "next/image";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import useAgeVerification from "@/hooks/useAgeVerification";

export default function AgeVerificationModal() {
  const { isChecking, isRequired, accept, reject } = useAgeVerification();

  if (!isChecking && !isRequired) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/70 px-4 backdrop-blur-md animate-in fade-in duration-300"
      aria-modal="true"
      role="dialog"
      aria-labelledby="age-gate-title"
      aria-describedby="age-gate-description"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(163,1,5,0.08),_transparent_40%),radial-gradient(circle_at_bottom,_rgba(0,0,0,0.04),_transparent_35%)]" />

      {isChecking ? (
        <div className="relative w-full max-w-md rounded-[28px] border border-black/10 bg-[#fefefe] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.10)] animate-in zoom-in-95 fade-in duration-300">
          <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-2 border-black/10 border-t-[#a30105]" />
          <p className="text-center text-sm font-medium uppercase tracking-[0.08em] text-black/60">
            Verifying Access
          </p>
          <h2 className="mt-2 text-center text-xl font-semibold text-black">
            Please wait a moment
          </h2>
        </div>
      ) : (
        <div className="relative w-full max-w-xl overflow-hidden rounded-[32px] border border-black/10 bg-[#fefefe] shadow-[0_25px_100px_rgba(0,0,0,0.14)] animate-in zoom-in-95 fade-in duration-300">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-10 -top-12 h-48 w-48 rounded-full bg-[#a30105]/[0.05] blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-black/[0.04] blur-3xl" />
          </div>

          <div className="relative border-b border-black/8 bg-gradient-to-b from-[#fff5f5] to-[#fefefe] px-6 py-6 sm:px-8 sm:py-7">
            <div className="absolute right-6 top-6 hidden sm:flex items-center gap-2 rounded-full border border-black/8 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-sm">
              <div className="relative h-6 w-6 overflow-hidden rounded-full">
                <Image
                  src="/images/vu-age-watermark.png"
                  alt="Vape Ustad"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/55">
                Vape Ustad
              </span>
            </div>

            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#a30105]/8 ring-1 ring-[#a30105]/10">
              <ShieldCheck className="h-7 w-7 text-[#a30105]" />
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a30105]">
              Age Restricted Access
            </p>

            <h2
              id="age-gate-title"
              className="mt-2 max-w-[32rem] text-2xl font-semibold tracking-tight text-black sm:text-3xl"
            >
              Confirm your age to enter Vape Ustad
            </h2>

            <p
              id="age-gate-description"
              className="mt-3 max-w-2xl text-sm leading-6 text-black/65 sm:text-[15px]"
            >
              This website contains vape-related products intended only for adults
              of legal smoking age. By entering, you confirm that you are at least
              18 years old and that viewing these products is lawful in your area.
            </p>
          </div>

          <div className="relative px-6 py-6 sm:px-8 sm:py-7">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-black/8 bg-black/[0.02] p-4 transition duration-200 hover:bg-black/[0.03]">
                <p className="text-sm font-semibold text-black">Adults only</p>
                <p className="mt-1 text-sm leading-6 text-black/60">
                  Entry is restricted to users who are 18+.
                </p>
              </div>

              <div className="rounded-2xl border border-black/8 bg-black/[0.02] p-4 transition duration-200 hover:bg-black/[0.03]">
                <p className="text-sm font-semibold text-black">One-time confirmation</p>
                <p className="mt-1 text-sm leading-6 text-black/60">
                  Once accepted, your device will remember this choice.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#a30105]/12 bg-[#a30105]/[0.04] p-4">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#a30105]" />
              <p className="text-sm leading-6 text-black/70">
                If you are under 18, please leave this website now.
              </p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={reject}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-black/12 bg-white px-5 text-sm font-medium text-black transition duration-200 hover:border-black/20 hover:bg-black/[0.03]"
              >
                I am under 18
              </button>

              <button
                type="button"
                onClick={accept}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#a30105] px-5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(163,1,5,0.22)] transition duration-200 hover:-translate-y-[1px] hover:bg-[#8e0104]"
              >
                Enter Store
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}