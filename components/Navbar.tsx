"use client";
import Link from "next/link";
import ThemeSwitch from "./ThemeSwitch";
import CartDrawer from "./CartDrawer";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-50 transition border-b ${scrolled ? "bg-white/80 dark:bg-black/60 backdrop-blur border-white/10" : "bg-transparent border-transparent"}`}>
      <div className="mx-auto max-w-[1200px] px-4 flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-baseline font-extrabold text-2xl select-none">
          <span className="text-vu-red">Vape</span>
          <span className="ml-1 dark:text-white text-black">Ustad</span>
        </Link>
    
          <nav className="flex items-center gap-2">
  <Link className="hover:underline" href="/">Home</Link>
  <Link className="hover:underline" href="/contact">Contact</Link>
  <ThemeSwitch />
  <CartDrawer />
</nav> 
      </div>
    </header>
  );
}
