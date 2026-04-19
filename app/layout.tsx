import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import Shortcuts from "@/components/Shortcuts";
import AgeVerificationModal from "@/components/AgeVerificationModal";
import { Toaster } from "sonner";

const SITE_URL = "https://vapeustad.com";
const SITE_NAME = "Vape Ustad";
const SITE_DESCRIPTION =
  "Shop premium vape devices, e-liquids, coils, disposables, and accessories at Vape Ustad with a clean, fast, and trusted ecommerce experience in Pakistan.";
const OG_IMAGE = "/og.png";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: "Vape Ustad | Premium Vape Store in Pakistan",
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Vape Ustad",
    "vape pakistan",
    "vape store pakistan",
    "e-liquid pakistan",
    "vape devices",
    "coils",
    "disposables",
    "vape accessories",
    "premium vape store",
  ],
  alternates: {
    canonical: "/",
  },
  category: "ecommerce",
  openGraph: {
    title: "Vape Ustad | Premium Vape Store in Pakistan",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Vape Ustad",
      },
    ],
    locale: "en_PK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vape Ustad | Premium Vape Store in Pakistan",
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fefefe",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="light">
      <body className="bg-[#fefefe] text-black">
        <Providers>
          <AgeVerificationModal />
          <Navbar />
          <main className="mx-auto max-w-[1200px] bg-[#fefefe] px-4 py-8 text-black">
            {children}
          </main>
          <Shortcuts />
          <Toaster richColors position="top-center" closeButton />
        </Providers>
      </body>
    </html>
  );
}