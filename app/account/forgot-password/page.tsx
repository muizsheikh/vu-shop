"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (!cleanEmail) {
        setError("Email address required hai.");
        return;
      }

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/account/reset-password`
          : "https://vapeustad.com/account/reset-password";

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        { redirectTo }
      );

      if (resetError) throw resetError;

      setMessage(
        "Password reset link has been sent. Please check your email to set a new password."
      );
    } catch (err: any) {
      setError(err?.message || "Reset email send nahi ho saki.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
          Account Recovery
        </p>
        <h1 className="mt-3 text-3xl font-black text-neutral-950">
          Forgot Password
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Enter your email address and we’ll send you a secure password reset link.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          type="email"
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
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-neutral-500">
        Remember password?{" "}
        <Link href="/account/login" className="font-bold text-[#a30105]">
          Login
        </Link>
      </p>
    </div>
  );
}