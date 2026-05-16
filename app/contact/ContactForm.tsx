"use client";

import { useEffect, useMemo, useState } from "react";

type ApiErrorResponse = {
  ok?: boolean;
  error?: string;
  errors?: Record<string, string[] | undefined>;
};

type PublicSettings = {
  store_name?: string;
  support_email?: string;
  whatsapp_number?: string;
};

const DEFAULT_SUPPORT_EMAIL = "info@vapeustad.com";
const DEFAULT_WHATSAPP_NUMBER = "923015554249";

function cleanWhatsAppNumber(value: string) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function formatWhatsAppNumber(value: string) {
  const clean = cleanWhatsAppNumber(value);

  if (!clean) return "Not configured";
  if (clean.startsWith("92")) return `+${clean}`;
  if (clean.startsWith("0")) return `+92${clean.slice(1)}`;

  return `+${clean}`;
}

export default function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadSettings() {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const json = await res.json().catch(() => null);

        if (!alive || !res.ok) return;

        setSettings(json?.settings || json || null);
      } catch {
        // Public settings are helpful but not required for form submission.
      }
    }

    loadSettings();

    return () => {
      alive = false;
    };
  }, []);

  const supportEmail = String(
    settings?.support_email || DEFAULT_SUPPORT_EMAIL
  ).trim();

  const whatsappNumber = cleanWhatsAppNumber(
    String(settings?.whatsapp_number || DEFAULT_WHATSAPP_NUMBER)
  );

  const whatsappUrl = useMemo(() => {
    const message = encodeURIComponent(
      "Hello Vape Ustad, I need help with a product or order."
    );

    return `https://wa.me/${whatsappNumber || DEFAULT_WHATSAPP_NUMBER}?text=${message}`;
  }, [whatsappNumber]);

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
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <a
          href={`mailto:${supportEmail}`}
          className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-[#a30105]/25 hover:bg-[#fff7f7]"
        >
          <div className="text-xs font-black uppercase tracking-wider text-[#a30105]">
            Support Email
          </div>
          <div className="mt-1 break-all text-sm font-bold text-neutral-950">
            {supportEmail}
          </div>
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            Use email for detailed product, order, or account support.
          </p>
        </a>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition hover:bg-emerald-100"
        >
          <div className="text-xs font-black uppercase tracking-wider text-emerald-700">
            WhatsApp Support
          </div>
          <div className="mt-1 text-sm font-bold text-emerald-800">
            {formatWhatsAppNumber(whatsappNumber)}
          </div>
          <p className="mt-2 text-xs leading-5 text-emerald-700">
            Use WhatsApp for quick order or product assistance.
          </p>
        </a>
      </div>

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
    </div>
  );
}
