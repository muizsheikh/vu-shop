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
      website:
        (f.elements.namedItem("website") as HTMLInputElement)?.value?.trim() || "",
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
    "w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white";

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-[24px] border border-neutral-200 bg-white p-5 shadow-[0_12px_35px_rgba(0,0,0,0.04)] md:p-6"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="contact-name"
            className="mb-2 block text-sm font-semibold text-neutral-900"
          >
            Your Name
          </label>
          <input
            id="contact-name"
            name="name"
            required
            placeholder="Enter your name"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="contact-email"
            className="mb-2 block text-sm font-semibold text-neutral-900"
          >
            Email Address
          </label>
          <input
            id="contact-email"
            name="email"
            required
            type="email"
            placeholder="Enter your email"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="contact-phone"
          className="mb-2 block text-sm font-semibold text-neutral-900"
        >
          Phone Number <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <input
          id="contact-phone"
          name="phone"
          placeholder="Enter your phone number"
          className={inputClass}
        />
      </div>

      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
      />

      <div>
        <label
          htmlFor="contact-message"
          className="mb-2 block text-sm font-semibold text-neutral-900"
        >
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          placeholder="Write your message"
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-neutral-500">
          Please include clear product or order details so we can help faster.
        </p>

        <button
          disabled={loading}
          className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-vu-red px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_25px_rgba(163,1,5,0.18)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send Message"}
        </button>
      </div>

      {msg ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {msg}
        </div>
      ) : null}
    </form>
  );
}