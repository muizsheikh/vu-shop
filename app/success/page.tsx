"use client";

import Image from "next/image";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import useSWR from "swr";
import { useEffect, useRef, useState } from "react";
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
      if (delta > 0) prev();
      else next();
    }
    startX.current = null;
  };

  return (
    <section
      className="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-label="Hero banner slider"
    >
      <div className="relative w-screen h-[60vh] md:h-[80vh] overflow-hidden">
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
          </div>
        ))}

        {len > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 hover:bg-black/60 p-2 text-white backdrop-blur"
              aria-label="Previous slide"
            >
              <ChevronLeft />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 hover:bg-black/60 p-2 text-white backdrop-blur"
              aria-label="Next slide"
            >
              <ChevronRight />
            </button>
          </>
        )}

        {len > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
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

/** ---------------- Page ---------------- **/
export default function HomePage() {
  const { data } = useSWR("/api/products", fetcher);
  const products = data?.products || [];
  const params = useSearchParams();
  const activeBrand = params.get("brand") || "";

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

  return (
    <div className="space-y-16">
      {/* Hero Slider */}
      <HeroSlider />

      {/* Collections (Fixed 4 groups) */}
      <section id="collections" className="space-y-8">
        <h2 className="text-center text-2xl font-bold">Shop Our Collections</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { name: "Devices", img: "/images/categories/devices.png" },
            { name: "Coils", img: "/images/categories/coils.png" },
            { name: "E-Liquids", img: "/images/categories/eliquids.png" },
            { name: "Disposables", img: "/images/categories/disposables.png" },
          ].map((c) => (
            <Link
              key={c.name}
              href={`/products?group=${encodeURIComponent(c.name)}`}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-28 h-28 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                <Image
                  src={c.img}
                  alt={c.name}
                  width={112}
                  height={112}
                  className="object-cover w-full h-full"
                />
              </div>
              <span className="font-medium">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Brands + New Arrivals */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Brands Sidebar */}
        <aside className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-black/10 dark:border-white/10 p-6">
            <h3 className="text-lg font-semibold mb-4">Brands</h3>
            <div className="flex flex-col gap-2">
              {BRANDS.map((b) => {
                const isActive = activeBrand.toLowerCase() === b.toLowerCase();
                return (
                  <Link
                    key={b}
                    href={`/products?brand=${encodeURIComponent(b)}`}
                    className={`block w-full px-3 py-2 rounded-lg text-sm text-center transition ${
                      isActive
                        ? "bg-vu-red text-white font-semibold"
                        : "bg-zinc-900 hover:bg-zinc-800 text-gray-300"
                    }`}
                  >
                    {b}
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        {/* New Arrivals Grid */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">New Arrivals</h2>
            <Link
              href="/products"
              className="text-sm text-vu-red hover:underline"
            >
              View All
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.slice(0, 6).map((p: any) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
