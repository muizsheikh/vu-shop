"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Shortcuts from "@/components/Shortcuts";
import AgeVerificationModal from "@/components/AgeVerificationModal";
import MobileBottomNav from "@/components/MobileBottomNav";

type SiteChromeProps = {
  children: React.ReactNode;
  forceMinimalChrome?: boolean;
};

export default function SiteChrome({
  children,
  forceMinimalChrome = false,
}: SiteChromeProps) {
  const pathname = usePathname();

  const isAttendanceApp =
    forceMinimalChrome ||
    pathname.startsWith("/attendance") ||
    pathname.startsWith("/staff-attendance");

  if (isAttendanceApp) {
    return (
      <main className="min-h-screen bg-[#f7f7f8] text-black">
        {children}
      </main>
    );
  }

  return (
    <>
      <AgeVerificationModal />
      <Navbar />
      <main className="mx-auto max-w-[1200px] bg-[#fefefe] px-4 pb-24 pt-8 text-black md:pb-8">
        {children}
      </main>
      <Shortcuts />
      <MobileBottomNav />
    </>
  );
}
