"use client";

import { useState } from "react";

export default function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const f = e.currentTarget;
    const data = {
      name: (f.elements.namedItem("name") as HTMLInputElement).value,
      email: (f.elements.namedItem("email") as HTMLInputElement).value,
      phone: (f.elements.namedItem("phone") as HTMLInputElement).value,
      message: (f.elements.namedItem("message") as HTMLTextAreaElement).value,
      // honeypot (hidden)
      website: (f.elements.namedItem("website") as HTMLInputElement)?.value || "",
    };

    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    setLoading(false);
    setMsg(res.ok ? "Thanks! We’ve received your message." : "Please check the form and try again.");
    if (res.ok) f.reset();
  }

  const inputClass =
    "w-full rounded-xl border border-white/20 bg-transparent px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white/20";

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input name="name" required placeholder="Your name" className={inputClass} />
      <input name="email" required type="email" placeholder="Email address" className={inputClass} />
      <input name="phone" placeholder="Phone (optional)" className={inputClass} />
      {/* Honeypot (hidden) */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" />
      <textarea name="message" required rows={5} placeholder="Your message" className={inputClass} />
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
