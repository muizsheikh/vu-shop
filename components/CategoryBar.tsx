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
  { label: "TANKS", href: "/products?group=Tanks", hasDropdown: true },
  { label: "SHOP BY BRANDS", href: "/products", hasDropdown: false },
];

export default function CategoryBar() {
  return (
    <div className="hidden border-t border-neutral-200 bg-[#fefefe] md:block">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex h-14 items-center gap-6 overflow-x-auto whitespace-nowrap scrollbar-hide">

          {categoryLinks.map((item, index) => {
            const isHome = index === 0;

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`group relative inline-flex h-full items-center gap-1 text-[14px] font-medium uppercase tracking-[0.02em] transition ${
                  isHome
                    ? "text-black"
                    : "text-neutral-700 hover:text-black"
                }`}
              >
                <span>{item.label}</span>

                {item.hasDropdown && (
                  <ChevronDown
                    size={14}
                    className="mt-[1px] text-neutral-500 transition group-hover:text-neutral-700"
                  />
                )}

                {/* THIN RED LINE */}
                {isHome ? (
                  <span className="absolute bottom-0 left-0 h-[2px] w-full bg-[#a30105]" />
                ) : (
                  <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-[#a30105] transition-all duration-200 group-hover:w-full" />
                )}
              </Link>
            );
          })}

        </div>
      </div>
    </div>
  );
}