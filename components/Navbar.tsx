"use client";

import Link from "next/link";
import ThemeSwitch from "./ThemeSwitch";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Cinzel } from "next/font/google";

// Premium font
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["700", "900"],
});

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-vu-black border-b border-white/10 h-16 flex items-center">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 w-full h-full">
        
{/* Branding Text */}
<Link href="/" className={`flex items-center ${cinzel.className}`}>
  <span className="text-3xl md:text-4xl font-extrabold tracking-wide leading-none">
    <span style={{ color: "#e50914" }}>VAPE</span>{" "}
    <span className="!text-white">Ustad Pvt. Ltd.</span>
  </span>
</Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link href="/" className="hover:text-vu-red text-white">
            Home
          </Link>
          <Link href="/products" className="hover:text-vu-red text-white">
            Products
          </Link>
          <Link href="/contact" className="hover:text-vu-red text-white">
            Contact
          </Link>
          <ThemeSwitch />
        </nav>

        {/* Mobile menu button */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 rounded-md hover:bg-white/10 text-white"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile Nav Drawer */}
      {open && (
        <div className="md:hidden bg-vu-black border-t border-white/10 px-4 py-3 space-y-3">
          <Link href="/" onClick={() => setOpen(false)} className="block text-white hover:text-vu-red">
            Home
          </Link>
          <Link href="/products" onClick={() => setOpen(false)} className="block text-white hover:text-vu-red">
            Products
          </Link>
          <Link href="/contact" onClick={() => setOpen(false)} className="block text-white hover:text-vu-red">
            Contact
          </Link>
          <ThemeSwitch />
        </div>
      )}
    </header>
  );
}
