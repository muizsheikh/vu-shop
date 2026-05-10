"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = searchParams.get("next") || "/account";

  const safeNextPath =
    nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/account";

      useEffect(() => {
  async function checkExistingSession() {
    const { data } = await supabase.auth.getUser();

    if (data.user) {
      router.replace(safeNextPath);
    }
  }

  checkExistingSession();
}, [router, safeNextPath]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      if (loginError) throw loginError;

      router.push(safeNextPath);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#a30105]">
          Welcome Back
        </p>
        <h1 className="mt-3 text-3xl font-black text-neutral-950">Login</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Login to continue checkout, view orders, and manage your account.
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

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition focus:border-[#a30105]"
        />

        <div className="text-right">
          <Link
            href="/account/forgot-password"
            className="text-sm font-bold text-[#a30105] hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <button
          disabled={loading}
          className="w-full rounded-2xl bg-[#a30105] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(163,1,5,0.18)] transition hover:bg-[#8f0104] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-neutral-500">
        New customer?{" "}
        <Link
          href={`/account/signup?next=${encodeURIComponent(safeNextPath)}`}
          className="font-bold text-[#a30105]"
        >
          Create account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md rounded-[28px] border border-neutral-200 bg-white p-6 text-center shadow-sm">
          Loading login...
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}