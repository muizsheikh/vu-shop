"use client";

import Link from "next/link";
import Image from "next/image";
import CartDrawer from "./CartDrawer";
import CategoryBar from "./CategoryBar";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, X, Search } from "lucide-react";
import { Instagram, Facebook } from "lucide-react";

const navLinks = [{ href: "/contact", label: "Contact" }];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [desktopQuery, setDesktopQuery] = useState("");
  const [mobileQuery, setMobileQuery] = useState("");
  const router = useRouter();

  const submitSearch = (rawQuery: string, closeMobile = false) => {
    const query = rawQuery.trim();

    if (!query) {
      router.push("/products");
      if (closeMobile) setOpen(false);
      return;
    }

    router.push(`/products?q=${encodeURIComponent(query)}`);
    if (closeMobile) setOpen(false);
  };

  const onDesktopSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitSearch(desktopQuery, false);
  };

  const onMobileSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitSearch(mobileQuery, true);
  };

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

        <nav className="hidden items-center gap-4 md:flex">
          <form
            onSubmit={onDesktopSubmit}
            className="flex items-center rounded-full border border-neutral-300 bg-neutral-100 px-3 py-2"
          >
            <Search size={16} className="mr-2 text-neutral-500" />
            <input
              type="text"
              value={desktopQuery}
              onChange={(e) => setDesktopQuery(e.target.value)}
              placeholder="Search products..."
              className="w-40 bg-transparent text-sm outline-none placeholder:text-neutral-500"
            />
            <button
              type="submit"
              aria-label="Search products"
              className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition hover:bg-white hover:text-black"
            >
              <Search size={15} />
            </button>
          </form>

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

          <div className="ml-2 flex items-center gap-2 text-sm text-neutral-600">
            <span className="hidden lg:block">Follow us:</span>

            <Instagram className="h-5 w-5 cursor-pointer hover:text-[#a30105]" />
            <Facebook className="h-5 w-5 cursor-pointer hover:text-[#a30105]" />

            <span className="cursor-pointer rounded-md border px-2 py-1 text-xs font-semibold hover:bg-neutral-100">
              Snap
            </span>
          </div>

          <div className="ml-2 flex items-center">
            <CartDrawer />
          </div>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <CartDrawer />

          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-200 bg-[#fefefe] text-black shadow-sm transition hover:bg-neutral-100"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <CategoryBar />

      {open && (
        <div className="border-t border-neutral-200 bg-[#fefefe] px-4 py-4 shadow-lg md:hidden">
          <form
            onSubmit={onMobileSubmit}
            className="mb-4 flex items-center rounded-full border border-neutral-300 bg-neutral-100 px-3 py-2"
          >
            <Search size={16} className="mr-2 text-neutral-500" />
            <input
              type="text"
              value={mobileQuery}
              onChange={(e) => setMobileQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-500"
            />
            <button
              type="submit"
              aria-label="Search products"
              className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-white hover:text-black"
            >
              <Search size={15} />
            </button>
          </form>

          <Link
            href="/contact"
            onClick={() => setOpen(false)}
            className="block rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800"
          >
            Contact
          </Link>
        </div>
      )}
    </header>
  );
}