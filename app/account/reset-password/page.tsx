"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const cleanPassword = password.trim();
      const cleanConfirm = confirmPassword.trim();

      if (cleanPassword.length < 6) {
        setError("Password kam az kam 6 characters ka hona chahiye.");
        return;
      }

      if (cleanPassword !== cleanConfirm) {
        setError("Password aur confirm password match nahi kar rahe.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: cleanPassword,
      });

      if (updateError) throw updateError;

      setMessage("Password successfully update ho gaya. Redirecting to login...");

      setTimeout(() => {
        router.push("/account/login");
      }, 1200);
    } catch (err: any) {
      setError(
        err?.message ||
          "Password reset failed. Link expire ho sakta hai, dobara reset email request karein."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
          Secure Reset
        </p>
        <h1 className="mt-3 text-3xl font-black text-neutral-950">
          Set New Password
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Apna new password enter karein.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          type="password"
          className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition focus:border-[#a30105]"
        />

        <input
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          type="password"
          className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition focus:border-[#a30105]"
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {message}
          </div>
        ) : null}

        <button
          disabled={loading}
          className="w-full rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(163,1,5,0.18)] transition hover:bg-[#8f0104] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-neutral-500">
        Back to{" "}
        <Link href="/account/login" className="font-bold text-[#a30105]">
          Login
        </Link>
      </p>
    </div>
  );
}