import type { Metadata } from "next";
import "@/app/globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import Shortcuts from "@/components/Shortcuts";

export const metadata: Metadata = {
  title: "Vape Ustad",
  description: "Premium Vape Store — Vape Ustad",
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
        </Providers>
      </body>
    </html>
  );
}
