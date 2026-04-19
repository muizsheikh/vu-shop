import type { Metadata } from "next";
import "@/app/globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import Shortcuts from "@/components/Shortcuts";
import AgeVerificationModal from "@/components/AgeVerificationModal";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  metadataBase: new URL("https://vapeustad.com"),
  title: "Vape Ustad — Premium Vape Store",
  description: "Curated devices, coils & e-liquids. Premium light shopping experience.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Vape Ustad — Premium Vape Store",
    description: "Curated devices, coils & e-liquids. Premium light shopping experience.",
    url: "https://vapeustad.com",
    siteName: "Vape Ustad",
    images: ["/og.png"],
    locale: "en_PK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vape Ustad — Premium Vape Store",
    description: "Curated devices, coils & e-liquids. Premium light shopping experience.",
    images: ["/og.png"],
  },
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