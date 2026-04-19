import type { Metadata } from "next";
import ContactForm from "./ContactForm";

const SITE_URL = "https://vapeustad.com";

export const metadata: Metadata = {
  title: "Contact Vape Ustad | Customer Support & Product Inquiries",
  description:
    "Contact Vape Ustad for product questions, order help, and general inquiries. Send us a message and our team will get back to you as soon as possible.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact Vape Ustad | Customer Support & Product Inquiries",
    description:
      "Get in touch with Vape Ustad for product support, order help, and general questions.",
    url: `${SITE_URL}/contact`,
    siteName: "Vape Ustad",
    type: "website",
    locale: "en_PK",
    images: [
      {
        url: `${SITE_URL}/og.png`,
        alt: "Contact Vape Ustad",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Vape Ustad",
    description:
      "Get in touch with Vape Ustad for product support, order help, and general questions.",
    images: [`${SITE_URL}/og.png`],
  },
};

export default function ContactPage() {
  const contactJsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact Vape Ustad",
    url: `${SITE_URL}/contact`,
    description:
      "Contact page for Vape Ustad customer support, order help, and product inquiries.",
    isPartOf: {
      "@type": "WebSite",
      name: "Vape Ustad",
      url: SITE_URL,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(contactJsonLd),
        }}
      />

      <section className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-10">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)] md:p-8">
          <div className="mb-6">
            <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-700">
              Contact
            </span>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-neutral-950 md:text-4xl">
              Get in touch with Vape Ustad
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 md:text-base">
              Have a question about products, orders, or anything else? Send us
              a message and we will get back to you as soon as possible.
            </p>
          </div>

          <div className="grid gap-4 rounded-[24px] border border-neutral-200 bg-neutral-50 p-4 md:grid-cols-3 md:p-5">
            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4">
              <div className="text-sm font-semibold text-neutral-900">
                Customer Support
              </div>
              <div className="mt-1 text-sm leading-6 text-neutral-600">
                Questions about products, availability, and ordering help.
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4">
              <div className="text-sm font-semibold text-neutral-900">
                Fast Response
              </div>
              <div className="mt-1 text-sm leading-6 text-neutral-600">
                We usually reply within 24 hours on working days.
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4">
              <div className="text-sm font-semibold text-neutral-900">
                Clean Support Flow
              </div>
              <div className="mt-1 text-sm leading-6 text-neutral-600">
                Simple contact form for quick and smooth communication.
              </div>
            </div>
          </div>

          <div className="mt-6">
            <ContactForm />
          </div>

          <p className="mt-5 text-xs text-neutral-500">
            We’ll reply as soon as possible. For urgent product or order
            questions, include clear details in your message.
          </p>
        </div>
      </section>
    </>
  );
}