"use client";

import Link from "next/link";
import Image from "next/image";
import ThemeSwitch from "./ThemeSwitch";
import CartDrawer from "./CartDrawer";
import CategoryBar from "./CategoryBar";
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
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-[#fefefe] text-black shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link href="/" onClick={() => setOpen(false)}>
          <Image
            src="/images/logo.png"
            alt="Vape Ustad"
            width={400}
            height={74}
            priority
            className="h-auto w-[220px] object-contain md:w-[300px]"
          />
        </Link>

        <nav className="hidden items-center gap-3 md:flex">
          <div className="flex items-center rounded-full border border-neutral-300 bg-neutral-100 px-3 py-2">
            <Search size={16} className="mr-2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search products..."
              className="w-40 bg-transparent text-sm outline-none placeholder:text-neutral-500"
            />
          </div>

          <div className="flex items-center rounded-full border border-neutral-200 bg-[#fefefe] p-1 shadow-sm">
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

          <div className="ml-2 flex items-center gap-2">
            <CartDrawer />
            <ThemeSwitch />
          </div>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <CartDrawer />

          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-200 bg-[#fefefe] text-black shadow-sm transition hover:bg-neutral-100"
            aria-label="Open menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <CategoryBar />

      {open && (
        <div className="border-t border-neutral-200 bg-[#fefefe] px-4 py-4 shadow-lg md:hidden">
          <div className="mb-4 flex items-center rounded-full border border-neutral-300 bg-neutral-100 px-3 py-2">
            <Search size={16} className="mr-2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-500"
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