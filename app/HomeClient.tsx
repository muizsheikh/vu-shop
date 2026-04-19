"use client";

import Image from "next/image";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import useSWR from "swr";
import { useEffect, useRef, useState, Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Product = {
  id?: string;
  item_code?: string;
  name?: string | null;
  item_name?: string | null;
  image: string | null;
  price: number | null;
  stock_qty?: number | null;
  stock?: number | null;
  in_stock?: boolean;
  item_group?: string | null;
  brand?: string | null;
  category?: string | null;
  homepage_section?: string | null;
  route?: string | null;
  slug?: string | null;
};

type CategoryTile = {
  title: string;
  href: string;
  image: string;
  subtitle: string;
  colClass: string;
};

type HomepageSectionConfig = {
  key: string;
  title: string;
  subtitle: string;
  apiUrl: string;
  viewAllHref: string;
};

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
      className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen select-none bg-[#fefefe]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-label="Hero banner slider"
    >
      <div className="mx-auto max-w-[1600px] px-0 md:px-4">
        <div className="relative overflow-hidden rounded-none border-y border-neutral-200 bg-white md:rounded-[24px] md:border md:shadow-[0_18px_50px_rgba(0,0,0,0.06)]">
          <div className="relative h-[420px] w-full sm:h-[500px] md:h-[560px] lg:h-[600px]">
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
                <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />
              </div>
            ))}

            <div className="absolute inset-0 mx-auto flex w-full max-w-7xl items-center px-5 sm:px-6 md:px-8">
              <div className="max-w-[560px] text-white">
                <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] backdrop-blur">
                  Vape Ustad
                </span>

                <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.4)] sm:text-5xl md:text-6xl">
                  Premium vaping products with a clean shopping experience
                </h1>

                <p className="mt-4 max-w-[520px] text-sm leading-6 text-white/90 drop-shadow-[0_4px_20px_rgba(0,0,0,0.4)] sm:text-[15px] md:text-base">
                  Explore original products, trusted brands, and a smoother
                  buying journey designed for speed, clarity, and confidence.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/products"
                    className="inline-flex min-h-[50px] items-center justify-center rounded-2xl bg-[#a30105] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_25px_rgba(163,1,5,0.35)] transition hover:bg-[#8a0004]"
                  >
                    Shop Now
                  </Link>

                  <Link
                    href="#collections"
                    className="inline-flex min-h-[50px] items-center justify-center rounded-2xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
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
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2.5 text-white backdrop-blur transition hover:bg-white/25 md:left-5"
                  aria-label="Previous slide"
                >
                  <ChevronLeft />
                </button>

                <button
                  onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2.5 text-white backdrop-blur transition hover:bg-white/25 md:right-5"
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
                      i === index ? "bg-white" : "bg-white/55 hover:bg-white/85"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** ---------------- New Trending Collage ---------------- **/
function TrendingCollageSection() {
  const [revealed, setRevealed] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setRevealed(entry.isIntersecting);
      },
      {
        threshold: 0.3,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const collageItems = [
    {
      src: "/images/banners/banner1.jpg",
      alt: "Trending showcase 1",
      posClass:
        "left-[2%] top-[16%] h-[150px] w-[120px] rounded-[24px] sm:left-[4%] sm:top-[18%] sm:h-[190px] sm:w-[150px] lg:h-[220px] lg:w-[180px]",
      hiddenClass: "-translate-x-20 -translate-y-8 rotate-[-10deg] scale-[0.92]",
      delay: "0ms",
    },
    {
      src: "/images/banners/banner2.jpg",
      alt: "Trending showcase 2",
      posClass:
        "left-[20%] top-[0%] h-[130px] w-[180px] rounded-[24px] sm:left-[22%] sm:h-[170px] sm:w-[250px] lg:h-[210px] lg:w-[320px]",
      hiddenClass: "-translate-x-14 -translate-y-12 rotate-[-6deg] scale-[0.95]",
      delay: "100ms",
    },
    {
      src: "/images/banners/banner3.jpg",
      alt: "Trending showcase 3",
      posClass:
        "right-[6%] top-[0%] h-[150px] w-[200px] rounded-[24px] sm:right-[8%] sm:h-[200px] sm:w-[280px] lg:h-[260px] lg:w-[360px]",
      hiddenClass: "translate-x-20 -translate-y-10 rotate-[8deg] scale-[0.94]",
      delay: "180ms",
    },
    {
      src: "/images/banners/banner4.jpg",
      alt: "Trending showcase 4",
      posClass:
        "left-[8%] bottom-[12%] h-[170px] w-[220px] rounded-[24px] sm:left-[12%] sm:h-[220px] sm:w-[300px] lg:h-[280px] lg:w-[380px]",
      hiddenClass: "-translate-x-24 translate-y-16 rotate-[-8deg] scale-[0.93]",
      delay: "240ms",
    },
    {
      src: "/images/banners/banner5.jpg",
      alt: "Trending showcase 5",
      posClass:
        "right-[20%] bottom-[10%] h-[150px] w-[210px] rounded-[24px] sm:right-[22%] sm:h-[190px] sm:w-[260px] lg:h-[240px] lg:w-[330px]",
      hiddenClass: "translate-x-12 translate-y-14 rotate-[7deg] scale-[0.95]",
      delay: "320ms",
    },
    {
      src: "/images/banners/banner2.jpg",
      alt: "Trending showcase 6",
      posClass:
        "right-[0%] bottom-[18%] h-[150px] w-[130px] rounded-[24px] sm:right-[2%] sm:h-[190px] sm:w-[170px] lg:h-[230px] lg:w-[220px]",
      hiddenClass: "translate-x-24 translate-y-6 rotate-[10deg] scale-[0.9]",
      delay: "380ms",
    },
  ];

  return (
    <section ref={sectionRef} className="pt-6 md:pt-10">
      <div className="overflow-hidden rounded-[32px] border border-neutral-200 bg-white px-4 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.05)] sm:px-6 md:px-8 md:py-10 lg:px-10">
        <div
          className={`mx-auto max-w-3xl text-center transition-all duration-700 ${
            revealed ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-700">
            New Trending
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-neutral-950 md:text-5xl">
            Fresh drops with a premium editorial feel
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-neutral-600 md:text-base">
            A curated visual highlight section designed to showcase new
            arrivals, featured drops, and standout collections in a cleaner,
            more premium way.
          </p>
        </div>

        <div className="relative mt-10 h-[560px] w-full overflow-hidden rounded-[28px] bg-[#f8f8f8] sm:h-[620px] lg:h-[760px]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(163,1,5,0.04),transparent_42%)]" />

          {collageItems.map((item, index) => (
            <div
              key={item.alt + index}
              className={`absolute overflow-hidden border border-white/70 bg-white shadow-[0_18px_45px_rgba(0,0,0,0.12)] transition-all duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${item.posClass} ${
                revealed
                  ? "translate-x-0 translate-y-0 rotate-0 scale-100 opacity-100"
                  : `${item.hiddenClass} opacity-0`
              }`}
              style={{ transitionDelay: item.delay, zIndex: 20 }}
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 50vw, 33vw"
              />
            </div>
          ))}

          <div
            className={`absolute inset-0 flex items-center justify-center px-4 transition-all duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              revealed ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
            }`}
            style={{ transitionDelay: "120ms", zIndex: 40 }}
          >
            <div className="max-w-[780px] text-center">
              <div
                className={`text-[34px] font-light uppercase tracking-[0.08em] text-[#a30105] transition-all duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:text-[54px] md:text-[72px] lg:text-[88px] ${
                  revealed ? "scale-100 opacity-100" : "scale-[0.88] opacity-0"
                }`}
                style={{ transitionDelay: "220ms" }}
              >
                NEW <span className="font-extrabold">TRENDING</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** ---------------- Category Tiles ---------------- **/
function CategoryTilesSection() {
  const tiles: CategoryTile[] = [
    {
      title: "PODS",
      subtitle: "Compact pod systems and everyday devices",
      href: "/products?category=PODS",
      image: "/images/categories/pods.jpg",
      colClass: "md:col-span-4",
    },
    {
      title: "E-LIQUIDS",
      subtitle: "Smooth flavors, premium blends, clean selection",
      href: "/products?category=FREEBASE%20E-LIQUIDS",
      image: "/images/categories/eliquids.jpg",
      colClass: "md:col-span-5",
    },
    {
      title: "POD MODS",
      subtitle: "Performance-focused pod mods and MTL kits",
      href: "/products?category=PODS",
      image: "/images/categories/pod-mods.jpg",
      colClass: "md:col-span-3",
    },
    {
      title: "DISPOSABLES",
      subtitle: "Ready to use, quick, convenient and popular",
      href: "/products?category=DISPOSABLES",
      image: "/images/categories/disposables.jpg",
      colClass: "md:col-span-4",
    },
    {
      title: "COILS / PODS / CARTRIDGES",
      subtitle: "Refill essentials and replacement hardware",
      href: "/products?category=COILS%20%2F%20PODS%20%2F%20CARTRIDGES",
      image: "/images/categories/coils.jpg",
      colClass: "md:col-span-8",
    },
  ];

  return (
    <section id="collections" className="space-y-8">
      <div className="text-center">
        <span className="inline-flex rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-700 shadow-sm">
          Collections
        </span>
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-neutral-950 md:text-4xl">
          Explore by Category
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-neutral-600 md:text-base">
          Browse the storefront through premium category blocks designed for
          faster discovery.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-12">
        {tiles.map((tile) => (
          <Link
            key={tile.title}
            href={tile.href}
            className={`group relative overflow-hidden rounded-[28px] border border-neutral-200 bg-black ${tile.colClass} lg:min-h-[280px]`}
          >
            <div className="absolute inset-0">
              <Image
                src={tile.image}
                alt={tile.title}
                fill
                className="object-cover transition duration-500 group-hover:scale-[1.05]"
              />
              <div className="absolute inset-0 bg-black/45 transition duration-300 group-hover:bg-black/35" />
            </div>

            <div className="relative flex h-full min-h-[220px] flex-col justify-end p-6 text-white">
              <div className="text-2xl font-extrabold tracking-[0.05em]">
                {tile.title}
              </div>
              <p className="mt-2 max-w-sm text-sm leading-6 text-white/85">
                {tile.subtitle}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** ---------------- Homepage Product Block ---------------- **/
function HomepageProductBlock({
  title,
  subtitle,
  apiUrl,
  viewAllHref,
}: HomepageSectionConfig) {
  const { data, isLoading } = useSWR(apiUrl, fetcher);

  const products: Product[] = Array.isArray(data?.products) ? data.products : [];

  if (!isLoading && products.length === 0) return null;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 border-t border-neutral-200 pt-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-700 shadow-sm">
            {title}
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 md:text-base">
            {subtitle}
          </p>
        </div>

        <Link
          href={viewAllHref}
          className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
        >
          View All
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:gap-6 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-[0_12px_35px_rgba(0,0,0,0.04)]"
            >
              <div className="h-44 animate-pulse bg-neutral-100 sm:h-52 md:h-60" />
              <div className="space-y-3 p-3 md:p-4">
                <div className="h-4 w-20 animate-pulse rounded bg-neutral-100" />
                <div className="h-5 w-full animate-pulse rounded bg-neutral-200" />
                <div className="h-5 w-3/4 animate-pulse rounded bg-neutral-100" />
                <div className="h-4 w-16 animate-pulse rounded bg-neutral-100" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:gap-6 xl:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.item_code || p.id} p={p} />
            ))}
          </div>

          {products.length >= 8 ? (
            <div className="flex justify-center">
              <Link
                href={viewAllHref}
                className="inline-flex min-h-[46px] items-center justify-center rounded-2xl bg-[#a30105] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_25px_rgba(163,1,5,0.18)] transition hover:bg-[#8a0004]"
              >
                View All
              </Link>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/** ---------------- HomeInner ---------------- **/
function HomeInner() {
  const sections: HomepageSectionConfig[] = [
    {
      key: "pods",
      title: "VAPES & PODS",
      subtitle: "Premium pod systems and compact everyday devices selected directly from ERP.",
      apiUrl: "/api/products?homepage_section=PODS&sort=homepage&limit=12",
      viewAllHref: "/products?category=PODS",
    },
    {
      key: "nic-salts",
      title: "NIC SALTS",
      subtitle: "Cleanly merchandised nic salt products controlled from ERP homepage mapping.",
      apiUrl: "/api/products?homepage_section=NIC%20SALTS&sort=homepage&limit=12",
      viewAllHref: "/products?category=NIC%20SALTS",
    },
    {
      key: "freebase",
      title: "FREEBASE E-LIQUIDS",
      subtitle: "Featured freebase e-liquid products pulled through structured ERP mapping.",
      apiUrl:
        "/api/products?homepage_section=FREEBASE%20E-LIQUIDS&sort=homepage&limit=12",
      viewAllHref: "/products?category=FREEBASE%20E-LIQUIDS",
    },
    {
      key: "disposables",
      title: "DISPOSABLES",
      subtitle: "Homepage-ready disposable products displayed in the exact order defined in ERP.",
      apiUrl: "/api/products?homepage_section=DISPOSABLES&sort=homepage&limit=12",
      viewAllHref: "/products?category=DISPOSABLES",
    },
    {
      key: "coils",
      title: "COILS / PODS / CARTRIDGES",
      subtitle: "Replacement hardware and refill essentials controlled from structured homepage fields.",
      apiUrl:
        "/api/products?homepage_section=COILS%20%2F%20PODS%20%2F%20CARTRIDGES&sort=homepage&limit=12",
      viewAllHref: "/products?category=COILS%20%2F%20PODS%20%2F%20CARTRIDGES",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-16 px-4 py-8 md:px-6 md:space-y-20">
      <TrendingCollageSection />

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

      <CategoryTilesSection />

      <section className="space-y-8">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.05)] md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-700">
                Featured Categories
              </span>
              <h2 className="mt-3 text-2xl font-bold text-neutral-950 md:text-3xl">
                Curated product blocks for faster shopping
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
                Homepage sections are now driven directly from ERP through
                dedicated homepage controls for cleaner merchandising and
                long-term scalability.
              </p>
            </div>

            <Link
              href="/products"
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
            >
              View All Products
            </Link>
          </div>
        </div>

        <div className="space-y-10">
          {sections.map((section) => (
            <HomepageProductBlock
              key={section.key}
              title={section.title}
              subtitle={section.subtitle}
              apiUrl={section.apiUrl}
              viewAllHref={section.viewAllHref}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

/** ---------------- Page ---------------- **/
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