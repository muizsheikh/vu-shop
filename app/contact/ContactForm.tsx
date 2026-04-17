"use client";

import { useState } from "react";

type ApiErrorResponse = {
  ok?: boolean;
  error?: string;
  errors?: Record<string, string[] | undefined>;
};

export default function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const f = e.currentTarget;

    const data = {
      name: (f.elements.namedItem("name") as HTMLInputElement).value.trim(),
      email: (f.elements.namedItem("email") as HTMLInputElement).value.trim(),
      phone: (f.elements.namedItem("phone") as HTMLInputElement).value.trim(),
      message: (f.elements.namedItem("message") as HTMLTextAreaElement).value.trim(),
      website: (f.elements.namedItem("website") as HTMLInputElement)?.value?.trim() || "",
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result: ApiErrorResponse | null = await res.json().catch(() => null);

      if (res.ok) {
        setMsg("Thanks! We’ve received your message.");
        f.reset();
        return;
      }

      const fieldErrors = result?.errors
        ? Object.values(result.errors).flat().filter(Boolean)
        : [];

      setMsg(
        fieldErrors?.[0] ||
          result?.error ||
          "Please check the form and try again."
      );
    } catch {
      setMsg("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-white/20 bg-transparent px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white/20";

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input name="name" required placeholder="Your name" className={inputClass} />
      <input
        name="email"
        required
        type="email"
        placeholder="Email address"
        className={inputClass}
      />
      <input name="phone" placeholder="Phone (optional)" className={inputClass} />
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" />
      <textarea
        name="message"
        required
        rows={5}
        placeholder="Your message"
        className={inputClass}
      />
      <button
        disabled={loading}
        className="inline-flex items-center justify-center rounded-xl px-4 py-2 bg-vu-red text-white hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Sending..." : "Send Message"}
      </button>
      {msg && <p className="opacity-80">{msg}</p>}
    </form>
  );
}