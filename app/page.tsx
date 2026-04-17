"use client";

import Image from "next/image";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import useSWR from "swr";
import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/** ---------------- Hero Slider ---------------- **/
function HeroSlider() {
  const slides = [
    "/images/banners/banner1.jpg",
    "/images/banners/banner2.jpg",
    "/images/banners/banner3.jpg",
    "/images/banners/banner4.jpg",
    "/images/banners/banner5.jpg",
  ].filter(Boolean);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<number | null>(null);
  const len = slides.length;

  useEffect(() => {
    if (len <= 1) return;
    if (timerRef.current) window.clearInterval(timerRef.current);

    if (!paused) {
      timerRef.current = window.setInterval(() => {
        setIndex((i) => (i + 1) % len);
      }, 4500);
    }

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [len, paused]);

  const prev = () => setIndex((i) => (i - 1 + len) % len);
  const next = () => setIndex((i) => (i + 1) % len);

  const startX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const delta = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(delta) > 40) {
      delta > 0 ? prev() : next();
    }
    startX.current = null;
  };

  return (
    <section
      className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-label="Hero banner slider"
    >
      <div className="relative h-[62vh] w-screen overflow-hidden md:h-[78vh]">
        {slides.map((src, i) => (
          <div
            key={src + i}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={i !== index}
          >
            <Image
              src={src}
              alt={`Banner ${i + 1}`}
              fill
              className="object-cover"
              priority={i === 0}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/20 to-transparent" />
          </div>
        ))}

        <div className="absolute inset-x-0 bottom-0 top-0 mx-auto flex w-full max-w-7xl items-center px-4 md:px-6">
          <div className="max-w-2xl text-white">
            <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] backdrop-blur">
              Vape Ustad
            </span>

            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
              Premium vaping products with a clean shopping experience
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-white/85 md:text-base">
              Explore original products, trusted brands, and a smoother buying
              journey designed for speed, clarity, and confidence.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex min-h-[50px] items-center justify-center rounded-2xl bg-vu-red px-6 py-3 text-sm font-semibold text-white transition hover:opacity-95"
              >
                Shop Now
              </Link>

              <Link
                href="#collections"
                className="inline-flex min-h-[50px] items-center justify-center rounded-2xl border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                View Collections
              </Link>
            </div>
          </div>
        </div>

        {len > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2.5 text-white backdrop-blur transition hover:bg-white/25"
              aria-label="Previous slide"
            >
              <ChevronLeft />
            </button>

            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2.5 text-white backdrop-blur transition hover:bg-white/25"
              aria-label="Next slide"
            >
              <ChevronRight />
            </button>
          </>
        )}

        {len > 1 && (
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-2.5 w-2.5 rounded-full transition ${
                  i === index
                    ? "bg-white"
                    : "bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** ---------------- HomeInner (uses useSearchParams) ---------------- **/
function HomeInner() {
  const { data, isLoading } = useSWR("/api/products", fetcher);
  const products = data?.products || [];

  const params = useSearchParams();
  const activeBrand = (params.get("brand") || "").toLowerCase();

  const BRANDS = [
    "Aspire",
    "Uwell",
    "Freemax",
    "GeekVape",
    "KUMIHO",
    "Lost Vape",
    "Oxva",
    "PAVA",
    "ROMIO",
    "SMOK",
    "Vaporesso",
    "Voopoo",
    "Yozo",
    "TOKYO DISPOSABLE",
    "H-ONE",
    "Used Pods",
    "Rincoe",
    "Reymont",
    "Chinese Pods",
    "WOMO",
  ];

  const COLLECTIONS = [
    { name: "Devices", img: "/images/categories/devices.png" },
    { name: "Coils", img: "/images/categories/coils.png" },
    { name: "E-Liquids", img: "/images/categories/eliquids.png" },
    { name: "Disposables", img: "/images/categories/disposables.png" },
  ];

  const featured = products.slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl space-y-16 px-4 py-2 md:px-6 md:space-y-20">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Authentic Products",
            text: "Trusted stock with premium product selection.",
          },
          {
            title: "Fast Shopping Flow",
            text: "Clean browsing, quick cart, and smooth checkout.",
          },
          {
            title: "Cash on Delivery",
            text: "Simple ordering experience for local customers.",
          },
          {
            title: "Premium Experience",
            text: "A refined storefront built for comfort and confidence.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-[24px] border border-neutral-200 bg-white px-5 py-5 shadow-[0_12px_35px_rgba(0,0,0,0.04)]"
          >
            <h3 className="text-base font-bold text-neutral-950">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              {item.text}
            </p>
          </div>
        ))}
      </section>

      <section id="collections" className="space-y-8">
        <div className="text-center">
          <span className="inline-flex rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-700 shadow-sm">
            Collections
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-neutral-950 md:text-4xl">
            Shop Our Collections
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-neutral-600 md:text-base">
            Browse curated categories for a faster and more premium shopping
            experience.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {COLLECTIONS.map((c) => (
            <Link
              key={c.name}
              href={`/products?group=${encodeURIComponent(c.name)}`}
              className="group rounded-[28px] border border-neutral-200 bg-white p-4 text-center shadow-[0_12px_35px_rgba(0,0,0,0.04)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(0,0,0,0.07)]"
            >
              <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-50">
                <Image
                  src={c.img}
                  alt={c.name}
                  width={112}
                  height={112}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className="mt-4 text-sm font-semibold text-neutral-900 md:text-base">
                {c.name}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr] lg:items-start">
        <aside className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)] lg:sticky lg:top-24">
          <div className="mb-5">
            <h3 className="text-lg font-bold text-neutral-950">Brands</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Shop your favorite brands directly.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {BRANDS.map((b) => {
              const isActive = activeBrand === b.toLowerCase();

              return (
                <Link
                  key={b}
                  href={`/products?brand=${encodeURIComponent(b)}`}
                  className={`inline-flex min-h-[42px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-vu-red text-white shadow-sm"
                      : "border border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 hover:bg-white hover:text-neutral-900"
                  }`}
                >
                  {b}
                </Link>
              );
            })}
          </div>
        </aside>

        <div className="space-y-5">
          <div className="flex flex-col gap-3 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.05)] md:flex-row md:items-center md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-700">
                New Arrivals
              </span>
              <h2 className="mt-3 text-2xl font-bold text-neutral-950 md:text-3xl">
                Fresh Picks from Vape Ustad
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Explore featured products selected for a clean and modern
                storefront experience.
              </p>
            </div>

            <Link
              href="/products"
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
            >
              View All Products
            </Link>
          </div>

          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_12px_35px_rgba(0,0,0,0.04)]"
                >
                  <div className="h-60 animate-pulse bg-neutral-100" />
                  <div className="space-y-3 p-4">
                    <div className="h-4 w-24 animate-pulse rounded bg-neutral-100" />
                    <div className="h-5 w-full animate-pulse rounded bg-neutral-200" />
                    <div className="h-5 w-3/4 animate-pulse rounded bg-neutral-100" />
                    <div className="h-4 w-20 animate-pulse rounded bg-neutral-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : featured.length === 0 ? (
            <div className="rounded-[28px] border border-neutral-200 bg-white p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-2xl">
                📦
              </div>
              <h3 className="mt-4 text-xl font-bold text-neutral-950">
                Products coming soon
              </h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                We are preparing more items for the storefront. Please check
                back shortly.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {featured.map((p: any) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/** ---------------- Page (wrap inner with Suspense) ---------------- **/
export default function HomePage() {
  return (
    <div className="space-y-16">
      <HeroSlider />
      <Suspense
        fallback={
          <div className="py-20 text-center text-neutral-600">Loading…</div>
        }
      >
        <HomeInner />
      </Suspense>
    </div>
  );
}