"use client";

import Link from "next/link";
import ThemeSwitch from "./ThemeSwitch";
import CartDrawer from "./CartDrawer";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Cinzel } from "next/font/google";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["700", "900"],
});

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200/80 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80 dark:border-white/10 dark:bg-vu-black/85">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link
          href="/"
          className={`group flex items-center ${cinzel.className}`}
          onClick={() => setOpen(false)}
        >
          <span className="text-[1.7rem] font-extrabold leading-none tracking-[0.04em] md:text-[2.1rem]">
            <span className="text-vu-red">VAPE</span>{" "}
            <span className="text-neutral-950 transition group-hover:text-neutral-700 dark:text-white">
              Ustad Pvt. Ltd.
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          <div className="flex items-center rounded-full border border-neutral-200 bg-white/90 p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950 dark:text-white/85 dark:hover:bg-white/10 dark:hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="ml-2 flex items-center gap-2">
            <CartDrawer />
            <ThemeSwitch />
          </div>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <CartDrawer />

          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-neutral-800 shadow-sm transition hover:bg-neutral-50 dark:border-white/10 dark:bg-white/5 dark:text-white"
            aria-label="Open menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-neutral-200 bg-white px-4 py-4 shadow-[0_20px_40px_rgba(0,0,0,0.05)] md:hidden dark:border-white/10 dark:bg-vu-black">
          <div className="space-y-2">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800 transition hover:border-neutral-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-white/60">
              Appearance
            </div>
            <ThemeSwitch />
          </div>
        </div>
      )}
    </header>
  );
}