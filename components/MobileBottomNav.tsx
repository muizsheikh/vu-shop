"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ShoppingBag,
  ShoppingCart,
  UserRound,
  MessageCircle,
} from "lucide-react";
import { useCartStore } from "@/store/cart";
import { useEffect, useState } from "react";

const WHATSAPP_URL =
  "https://wa.me/923015554249?text=Assalam%20o%20Alaikum%2C%20mujhe%20Vape%20Ustad%20par%20help%20chahiye.";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { count } = useCartStore();
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  if (pathname.startsWith("/attendance") || pathname.startsWith("/staff-attendance")) {
    return null;
  }

  const cartCount = ready ? count() : 0;

  const isHome = pathname === "/";
  const isProducts = pathname.startsWith("/products");
  const isCart = pathname.startsWith("/checkout") || pathname.startsWith("/cart");
  const isAccount = pathname.startsWith("/account");

  const itemClass = (active: boolean) =>
    `flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-bold transition active:bg-neutral-100 ${
      active
        ? "bg-[#a30105]/10 text-[#a30105]"
        : "text-neutral-700 hover:bg-neutral-50"
    }`;

  const iconClass = (active: boolean) =>
    `mb-1 h-5 w-5 ${active ? "text-[#a30105]" : "text-neutral-500"}`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] border-t border-neutral-200 bg-[#fefefe]/95 px-2 py-2 shadow-[0_-12px_35px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        <Link href="/" className={itemClass(isHome)}>
          <Home className={iconClass(isHome)} />
          Home
        </Link>

        <Link href="/products" className={itemClass(isProducts)}>
          <ShoppingBag className={iconClass(isProducts)} />
          Products
        </Link>

        <Link href="/checkout" className={`relative ${itemClass(isCart)}`}>
          <ShoppingCart className={iconClass(isCart)} />
          Cart
          {cartCount > 0 ? (
            <span className="absolute right-3 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#a30105] px-1 text-[10px] font-black text-white">
              {cartCount}
            </span>
          ) : null}
        </Link>

        <Link href="/account" className={itemClass(isAccount)}>
          <UserRound className={iconClass(isAccount)} />
          Account
        </Link>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-bold text-neutral-700 transition hover:bg-green-50 active:bg-green-50"
        >
          <MessageCircle className="mb-1 h-5 w-5 text-green-600" />
          Help
        </a>
      </div>
    </div>
  );
}
