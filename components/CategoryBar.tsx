"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";

type SubItem = {
  label: string;
  href: string;
};

type CategoryItem = {
  label: string;
  href: string;
  hasDropdown?: boolean;
  submenu?: SubItem[];
};

const categoryLinks: CategoryItem[] = [
  { label: "HOME", href: "/" },

  {
    label: "VAPES",
    href: "/products?group=Devices",
    hasDropdown: true,
    submenu: [
      { label: "Pod Kits", href: "/products?group=Devices&category=Pod%20Kits" },
      { label: "Box Mods", href: "/products?group=Devices&category=Box%20Mods" },
      { label: "Starter Kits", href: "/products?group=Devices&category=Starter%20Kits" },
    ],
  },

  {
    label: "E-LIQUID",
    href: "/products?group=E-Liquids",
    hasDropdown: true,
    submenu: [
      { label: "Freebase", href: "/products?group=E-Liquids&category=Freebase" },
      { label: "Tokyo E-Liquid", href: "/products?group=E-Liquids&brand=Tokyo" },
      { label: "Drip Down E-Liquid", href: "/products?group=E-Liquids&brand=Drip%20Down" },
      { label: "VGOD E-Liquid", href: "/products?group=E-Liquids&brand=VGOD" },
      { label: "UK Salt E-Liquid", href: "/products?group=E-Liquids&brand=UK%20Salt" },
      { label: "Hero Puff E-Liquid", href: "/products?group=E-Liquids&brand=Hero%20Puff" },
      { label: "Oxva E-Liquid", href: "/products?group=E-Liquids&brand=Oxva" },
    ],
  },

  {
    label: "NIC SALTS",
    href: "/products?group=E-Liquids",
    hasDropdown: true,
    submenu: [
      { label: "Fruit Salts", href: "/products?group=E-Liquids&category=Fruit%20Salts" },
      { label: "Mint Salts", href: "/products?group=E-Liquids&category=Mint%20Salts" },
      { label: "Tobacco Salts", href: "/products?group=E-Liquids&category=Tobacco%20Salts" },
    ],
  },

  {
    label: "POD SYSTEM DEVICES",
    href: "/products?group=Devices",
    hasDropdown: true,
    submenu: [
      { label: "MTL Pod System", href: "/products?group=Devices&category=MTL%20Pod%20System" },
      { label: "Pod Mod", href: "/products?group=Devices&category=Pod%20Mod" },
      { label: "Uwell", href: "/products?group=Devices&brand=Uwell" },
    ],
  },

  {
    label: "PREFILLED / DISPOSABLES",
    href: "/products?group=Disposables",
    hasDropdown: true,
    submenu: [
      { label: "Yozo Disposables", href: "/products?group=Disposables&brand=Yozo" },
      { label: "Tokyo Disposables", href: "/products?group=Disposables&brand=Tokyo" },
      { label: "H-One Disposables", href: "/products?group=Disposables&brand=H-One" },
    ],
  },

  {
    label: "TANKS",
    href: "/products?group=Tanks",
    hasDropdown: true,
    submenu: [
      { label: "Sub-Ohm Tanks", href: "/products?group=Tanks&category=Sub-Ohm%20Tanks" },
      { label: "MTL Tanks", href: "/products?group=Tanks&category=MTL%20Tanks" },
    ],
  },

  {
    label: "SHOP BY BRANDS",
    href: "/products",
    hasDropdown: true,
    submenu: [
      { label: "Oxva", href: "/products?brand=Oxva" },
      { label: "Uwell", href: "/products?brand=Uwell" },
      { label: "GeekVape", href: "/products?brand=GeekVape" },
      { label: "Vaporesso", href: "/products?brand=Vaporesso" },
      { label: "Voopoo", href: "/products?brand=Voopoo" },
      { label: "Smok", href: "/products?brand=Smok" },
      { label: "Nevoks", href: "/products?brand=Nevoks" },
      { label: "Freemax", href: "/products?brand=Freemax" },
    ],
  },
];

export default function CategoryBar() {
  return (
    <div className="hidden border-t border-neutral-200 bg-[#fefefe] md:block">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="relative flex h-14 items-center gap-6 whitespace-nowrap overflow-visible">
          {categoryLinks.map((item, index) => {
            const isHome = index === 0;
            const hasDropdown = Boolean(item.hasDropdown && item.submenu?.length);

            return (
              <div key={item.label} className="group relative h-full shrink-0">
                <Link
                  href={item.href}
                  className={`relative inline-flex h-full items-center gap-1 text-[14px] font-medium uppercase tracking-[0.02em] transition ${
                    isHome ? "text-black" : "text-neutral-700 hover:text-black"
                  }`}
                >
                  <span>{item.label}</span>

                  {hasDropdown ? (
                    <ChevronDown
                      size={14}
                      className="mt-[1px] text-neutral-500 transition duration-200 group-hover:rotate-180 group-hover:text-neutral-700"
                    />
                  ) : null}

                  {isHome ? (
                    <span className="absolute bottom-0 left-0 h-[2px] w-full bg-[#a30105]" />
                  ) : (
                    <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-[#a30105] transition-all duration-200 group-hover:w-full" />
                  )}
                </Link>

                {hasDropdown ? (
                  <div className="invisible absolute left-0 top-full z-[80] pt-0 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                    <div className="mt-0 min-w-[260px] rounded-2xl border border-neutral-200 bg-white p-3 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
                      <div className="mb-2 border-b border-neutral-100 px-2 pb-2">
                        <Link
                          href={item.href}
                          className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#a30105]"
                        >
                          View All
                        </Link>
                      </div>

                      <div className="grid gap-1">
                        {item.submenu?.map((subItem) => (
                          <Link
                            key={subItem.label}
                            href={subItem.href}
                            className="rounded-xl px-3 py-2 text-[14px] font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-black"
                          >
                            {subItem.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}