"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";

const categoryLinks = [
  { label: "HOME", href: "/" },
  { label: "VAPES", href: "/products?group=Devices", hasDropdown: true },
  { label: "E-LIQUID", href: "/products?group=E-Liquids", hasDropdown: true },
  { label: "NIC SALTS", href: "/products?group=E-Liquids", hasDropdown: true },
  { label: "POD SYSTEM DEVICES", href: "/products?group=Devices", hasDropdown: true },
  { label: "PREFILLED / DISPOSABLES", href: "/products?group=Disposables", hasDropdown: true },
  { label: "ACCESSORIES", href: "/products?group=Accessories", hasDropdown: true },
  { label: "TANKS", href: "/products?group=Tanks", hasDropdown: true },
  { label: "SHOP BY BRANDS", href: "/products", hasDropdown: false },
];

export default function CategoryBar() {
  return (
    <div className="hidden border-t border-neutral-200 bg-[#fefefe] md:block">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex h-14 items-center gap-7 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {categoryLinks.map((item, index) => {
            const isHome = index === 0;

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`group relative inline-flex h-full items-center gap-1 text-[15px] font-extrabold uppercase tracking-[0.01em] transition ${
                  isHome
                    ? "text-neutral-950"
                    : "text-neutral-800 hover:text-neutral-950"
                }`}
              >
                <span>{item.label}</span>

                {item.hasDropdown ? (
                  <ChevronDown
                    size={16}
                    className="mt-[1px] text-neutral-500 transition group-hover:text-neutral-800"
                  />
                ) : null}

                {isHome ? (
                  <span className="absolute bottom-0 left-0 h-1 w-full rounded-full bg-vu-red" />
                ) : (
                  <span className="absolute bottom-0 left-0 h-1 w-0 rounded-full bg-vu-red transition-all duration-200 group-hover:w-full" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}