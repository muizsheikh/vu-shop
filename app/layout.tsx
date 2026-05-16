import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@/app/globals.css";
import Providers from "@/components/Providers";
import PwaRegister from "@/components/PwaRegister";
import SiteChrome from "@/components/SiteChrome";
import { Toaster } from "sonner";

const SITE_URL = "https://vapeustad.com";
const SITE_NAME = "Vape Ustad";
const SITE_DESCRIPTION =
  "Shop premium vape devices, e-liquids, coils, disposables, and accessories at Vape Ustad with a clean, fast, and trusted ecommerce experience in Pakistan.";
const OG_IMAGE = "/og.png";
const ATTENDANCE_HOST = "attendance.vapeustad.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  manifest: "/manifest.json",
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
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#fefefe",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const host = headersList.get("host")?.split(":")[0]?.toLowerCase() || "";
  const forceMinimalChrome = host === ATTENDANCE_HOST;

  return (
    <html lang="en" suppressHydrationWarning className="light">
      <body className="bg-[#fefefe] text-black">
        <Providers>
          <PwaRegister />
          <SiteChrome forceMinimalChrome={forceMinimalChrome}>
            {children}
          </SiteChrome>
          <Toaster richColors position="top-center" closeButton />
        </Providers>
      </body>
    </html>
  );
}
