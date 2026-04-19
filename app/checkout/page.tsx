import type { Metadata } from "next";
import CheckoutClient from "./CheckoutClient";

const SITE_URL = "https://vapeustad.com";

export const metadata: Metadata = {
  title: "Checkout | Vape Ustad",
  description:
    "Complete your Vape Ustad order with a secure and smooth checkout experience.",
  alternates: {
    canonical: "/checkout",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  openGraph: {
    title: "Checkout | Vape Ustad",
    description:
      "Complete your Vape Ustad order with a secure and smooth checkout experience.",
    url: `${SITE_URL}/checkout`,
    siteName: "Vape Ustad",
    type: "website",
    locale: "en_PK",
    images: [
      {
        url: `${SITE_URL}/og.png`,
        alt: "Vape Ustad Checkout",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Checkout | Vape Ustad",
    description:
      "Complete your Vape Ustad order with a secure and smooth checkout experience.",
    images: [`${SITE_URL}/og.png`],
  },
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}