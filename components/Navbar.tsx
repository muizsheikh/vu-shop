"use client";

import Link from "next/link";
import Image from "next/image";
import CartDrawer from "./CartDrawer";
import CategoryBar from "./CategoryBar";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, X, Search, User, UserPlus, CheckCircle2 } from "lucide-react";
import { Instagram, Facebook } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [desktopQuery, setDesktopQuery] = useState("");
  const [mobileQuery, setMobileQuery] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [customerName, setCustomerName] = useState("");

  const router = useRouter();

  useEffect(() => {
    async function loadCustomer() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        setIsLoggedIn(false);
        setCustomerName("");
        return;
      }

      setIsLoggedIn(true);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const fullName = String(profile?.full_name || "").trim();
      const fallbackName = String(user.email || "Customer").split("@")[0];

      setCustomerName(fullName || fallbackName);
    }

    loadCustomer();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadCustomer();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

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

  const shortName =
    customerName.length > 14 ? `${customerName.slice(0, 14)}...` : customerName;

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

          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <Link
                href="/account"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white px-5 text-sm font-black text-neutral-900 shadow-sm transition hover:bg-neutral-50"
              >
                <User className="h-4 w-4 text-[#a30105]" />
                {shortName || "My Account"}
              </Link>

              <Link
                href="/account"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-green-200 bg-green-50 px-5 text-sm font-black text-green-700 shadow-sm transition hover:bg-green-100"
              >
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Logged in
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/account/login"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[#a30105]/15 bg-white px-5 text-sm font-black text-neutral-900 shadow-sm transition hover:border-[#a30105]/30 hover:bg-[#fff7f7]"
              >
                <User className="h-4 w-4 text-[#a30105]" />
                Login
              </Link>

              <Link
                href="/account/signup"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#a30105] px-5 text-sm font-black text-white shadow-[0_10px_28px_rgba(163,1,5,0.18)] transition hover:bg-[#8f0104]"
              >
                <UserPlus className="h-4 w-4" />
                Register
              </Link>
            </div>
          )}

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
          <Link
            href={isLoggedIn ? "/account" : "/account/login"}
            onClick={() => setOpen(false)}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border bg-white shadow-sm transition ${
              isLoggedIn
                ? "border-green-200 text-green-600 hover:bg-green-50"
                : "border-[#a30105]/15 text-[#a30105] hover:bg-[#fff7f7]"
            }`}
            aria-label="Account"
          >
            {isLoggedIn ? <CheckCircle2 size={19} /> : <User size={19} />}
          </Link>

          <CartDrawer />

          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-200 bg-[#fefefe] text-black shadow-sm transition hover:bg-neutral-100"
            aria-label="Toggle menu"
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

          <div className="grid gap-2">
            {isLoggedIn ? (
              <>
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Logged in as {customerName || "Customer"}
                </Link>

                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-900"
                >
                  My Account
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/account/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-2xl border border-[#a30105]/15 bg-[#fff7f7] px-4 py-3 text-sm font-bold text-[#a30105]"
                >
                  <User className="h-4 w-4" />
                  Login
                </Link>

                <Link
                  href="/account/signup"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-2xl bg-[#a30105] px-4 py-3 text-sm font-bold text-white"
                >
                  <UserPlus className="h-4 w-4" />
                  Register
                </Link>
              </>
            )}

            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="block rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800"
            >
              Contact
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}