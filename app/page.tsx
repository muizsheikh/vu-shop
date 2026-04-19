import type { Metadata } from "next";
import HomeClient from "./HomeClient";

/* SEO METADATA */
export const metadata: Metadata = {
  title: "Vape Ustad Pakistan | Premium Vapes, E-Liquids & Accessories",
  description:
    "Buy premium vapes, e-liquids, pods, coils and accessories in Pakistan. Vape Ustad offers authentic products, best prices and fast delivery.",
  metadataBase: new URL("https://vapeustad.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Vape Ustad Pakistan | Premium Vape Store",
    description:
      "Shop authentic vapes, e-liquids, pods and accessories in Pakistan with fast delivery.",
    url: "https://vapeustad.com",
    siteName: "Vape Ustad",
    images: ["/og.png"],
    locale: "en_PK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vape Ustad Pakistan",
    description:
      "Premium vape store in Pakistan. Authentic products, best prices.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

/* OPTIONAL STRUCTURED DATA */
function JsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: "Vape Ustad",
    url: "https://vapeustad.com",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function Page() {
  return (
    <>
      <JsonLd />
      <HomeClient />
    </>
  );
}