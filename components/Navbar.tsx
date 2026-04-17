"use client";

import Link from "next/link";
import Image from "next/image";
import ThemeSwitch from "./ThemeSwitch";
import CartDrawer from "./CartDrawer";
import { useState } from "react";
import { Menu, X, Search } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white text-black border-b border-neutral-200 shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">

        {/* LOGO IMAGE */}
        <Link href="/" onClick={() => setOpen(false)}>
          <Image
            src="/images/logo.png"
            alt="Vape Ustad"
            width={220}
            height={60}
            priority
            className="h-auto w-[160px] md:w-[200px] object-contain"
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-3 md:flex">

          {/* Search */}
          <div className="flex items-center rounded-full border border-neutral-300 bg-neutral-100 px-3 py-2">
            <Search size={16} className="text-neutral-500 mr-2" />
            <input
              type="text"
              placeholder="Search products..."
              className="bg-transparent outline-none text-sm w-40 placeholder:text-neutral-500"
            />
          </div>

          {/* Links */}
          <div className="flex items-center rounded-full border border-neutral-200 bg-white p-1 shadow-sm">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-black"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="ml-2 flex items-center gap-2">
            <CartDrawer />
            <ThemeSwitch />
          </div>
        </nav>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <CartDrawer />

          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-black shadow-sm transition hover:bg-neutral-100"
            aria-label="Open menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div className="border-t border-neutral-200 bg-white px-4 py-4 shadow-lg md:hidden">

          {/* Search */}
          <div className="mb-4 flex items-center rounded-full border border-neutral-300 bg-neutral-100 px-3 py-2">
            <Search size={16} className="text-neutral-500 mr-2" />
            <input
              type="text"
              placeholder="Search products..."
              className="bg-transparent outline-none text-sm w-full placeholder:text-neutral-500"
            />
          </div>

          <div className="space-y-2">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800 transition hover:bg-white"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
              Appearance
            </div>
            <ThemeSwitch />
          </div>
        </div>
      )}
    </header>
  );
}