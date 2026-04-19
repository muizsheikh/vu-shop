import type { Metadata } from "next";
import SuccessClient from "./SuccessClient";

const SITE_URL = "https://vapeustad.com";

export const metadata: Metadata = {
  title: "Order Success | Vape Ustad",
  description:
    "Your order has been received successfully by Vape Ustad.",
  alternates: {
    canonical: "/success",
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
    title: "Order Success | Vape Ustad",
    description: "Your order has been received successfully by Vape Ustad.",
    url: `${SITE_URL}/success`,
    siteName: "Vape Ustad",
    type: "website",
    locale: "en_PK",
    images: [
      {
        url: `${SITE_URL}/og.png`,
        alt: "Vape Ustad Order Success",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Order Success | Vape Ustad",
    description: "Your order has been received successfully by Vape Ustad.",
    images: [`${SITE_URL}/og.png`],
  },
};

export default function SuccessPage() {
  return <SuccessClient />;
}