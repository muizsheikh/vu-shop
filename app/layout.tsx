// /app/layout.tsx
import type { Metadata } from "next";
import "@/app/globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import Shortcuts from "@/components/Shortcuts";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  metadataBase: new URL("https://vapeustad.com"),
  title: "Vape Ustad — Premium Vape Store",
  description: "Curated devices, coils & e-liquids. Fast, dark-mode first.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Vape Ustad — Premium Vape Store",
    description: "Curated devices, coils & e-liquids. Fast, dark-mode first.",
    url: "https://vapeustad.com",
    siteName: "Vape Ustad",
    images: ["/og.png"],
    locale: "en_PK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vape Ustad — Premium Vape Store",
    description: "Curated devices, coils & e-liquids. Fast, dark-mode first.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <Navbar />
          <main className="mx-auto max-w-[1200px] px-4 py-8">{children}</main>
          <Shortcuts />
          {/* Global toast portal */}
          <Toaster richColors position="top-center" closeButton />
        </Providers>
      </body>
    </html>
  );
}
