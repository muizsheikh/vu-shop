"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import ProductCard from "@/components/ProductCard";

type Product = {
  id: string;
  name?: string | null;
  image: string | null;
  price: number | null;
  stock_qty?: number | null;
  in_stock?: boolean;
  item_group?: string | null;
  brand?: string | null;
  category?: string | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function FilterChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700 shadow-sm">
      {label}: {value}
    </span>
  );
}

function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-neutral-200 pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-neutral-900">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function getPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 1) return [];

  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);

  for (let i = currentPage - 1; i <= currentPage + 1; i += 1) {
    if (i > 1 && i < totalPages) pages.add(i);
  }

  return Array.from(pages).sort((a, b) => a - b);
}

function ProductsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const brand = params.get("brand") || "";
  const group = params.get("group") || "";
  const category = params.get("category") || "";
  const q = params.get("q") || "";
  const page = params.get("page") || "1";
  const minPrice = params.get("min_price") || "";
  const maxPrice = params.get("max_price") || "";
  const sort = params.get("sort") || "";
  const inStockOnly = params.get("in_stock") === "1";

  const [minInput, setMinInput] = useState(minPrice);
  const [maxInput, setMaxInput] = useState(maxPrice);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    setMinInput(minPrice);
  }, [minPrice]);

  useEffect(() => {
    setMaxInput(maxPrice);
  }, [maxPrice]);

  useEffect(() => {
    setMobileFiltersOpen(false);
  }, [brand, group, category, q, page, minPrice, maxPrice, sort, inStockOnly]);

  const apiUrl = `/api/products?brand=${encodeURIComponent(
    brand
  )}&group=${encodeURIComponent(group)}&category=${encodeURIComponent(
    category
  )}&q=${encodeURIComponent(q)}&page=${encodeURIComponent(
    page
  )}&min_price=${encodeURIComponent(minPrice)}&max_price=${encodeURIComponent(
    maxPrice
  )}`;

  const { data, error, isLoading } = useSWR(apiUrl, fetcher);

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

  const GROUPS = ["Devices", "Coils", "E-Liquids", "Disposables", "Tanks"];

  const activeBrand = brand.toLowerCase();
  const rawProducts: Product[] = Array.isArray(data?.products) ? data.products : [];

  const sorted = useMemo(() => {
    let products = [...rawProducts];

    if (inStockOnly) {
      products = products.filter(
        (p) => !(p.in_stock === false || p.stock_qty === 0)
      );
    }

    if (sort === "price_asc") {
      products.sort((a, b) => {
        const aPrice =
          typeof a.price === "number" ? a.price : Number.POSITIVE_INFINITY;
        const bPrice =
          typeof b.price === "number" ? b.price : Number.POSITIVE_INFINITY;
        return aPrice - bPrice;
      });
    } else if (sort === "price_desc") {
      products.sort((a, b) => {
        const aPrice =
          typeof a.price === "number" ? a.price : Number.NEGATIVE_INFINITY;
        const bPrice =
          typeof b.price === "number" ? b.price : Number.NEGATIVE_INFINITY;
        return bPrice - aPrice;
      });
    }

    return products;
  }, [rawProducts, inStockOnly, sort]);

  const dynamicBrands = useMemo(() => {
    const set = new Set(
      sorted.map((p) => (p.brand || "").trim()).filter(Boolean)
    );
    return BRANDS.filter((b) => set.has(b));
  }, [sorted]);

  const dynamicGroups = useMemo(() => {
    const set = new Set(
      sorted.map((p) => (p.item_group || "").trim()).filter(Boolean)
    );
    const known = GROUPS.filter((g) => set.has(g));
    const extra = Array.from(set).filter((g) => !GROUPS.includes(g));
    return [...known, ...extra];
  }, [sorted]);

  const dynamicCategories = useMemo(() => {
    const set = new Set(
      sorted.map((p) => (p.category || "").trim()).filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sorted]);

  const currentPage = Math.max(
    1,
    Number(
      data?.page ??
        data?.current_page ??
        data?.currentPage ??
        data?.pagination?.page ??
        data?.pagination?.current_page ??
        data?.pagination?.currentPage ??
        data?.meta?.page ??
        page ??
        1
    ) || 1
  );

  const totalPagesRaw = Number(
    data?.total_pages ??
      data?.totalPages ??
      data?.pages ??
      data?.pagination?.total_pages ??
      data?.pagination?.totalPages ??
      data?.pagination?.pages ??
      data?.meta?.pages ??
      1
  );

  const totalPages = Math.max(1, totalPagesRaw || 1);
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  const updateFilters = (
    updates: Record<string, string | null | undefined>,
    options?: { preservePage?: boolean }
  ) => {
    const next = new URLSearchParams(params.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value == null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });

    if (!options?.preservePage) {
      next.delete("page");
    }

    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const goToPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(1, nextPage), totalPages);

    const next = new URLSearchParams(params.toString());
    if (safePage <= 1) {
      next.delete("page");
    } else {
      next.set("page", String(safePage));
    }

    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const toggleBrand = (value: string) => {
    updateFilters({
      brand: brand === value ? null : value,
    });
  };

  const toggleGroup = (value: string) => {
    updateFilters({
      group: group === value ? null : value,
    });
  };

  const toggleCategory = (value: string) => {
    updateFilters({
      category: category === value ? null : value,
    });
  };

  const toggleInStock = () => {
    updateFilters({
      in_stock: inStockOnly ? null : "1",
    });
  };

  const applyPriceFilter = () => {
    updateFilters({
      min_price: minInput.trim() || null,
      max_price: maxInput.trim() || null,
    });
  };

  const clearAll = () => {
    setMobileFiltersOpen(false);
    router.push("/products");
  };

  const filtersContent = (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-neutral-950">Filters</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Narrow down your product search.
          </p>
        </div>

        <button
          type="button"
          onClick={clearAll}
          className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a30105] transition hover:opacity-80"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-5">
        <SidebarSection title="Stock">
          <button
            type="button"
            onClick={toggleInStock}
            className={`inline-flex min-h-[42px] w-full items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition ${
              inStockOnly
                ? "bg-vu-red text-white shadow-sm"
                : "border border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 hover:bg-white hover:text-neutral-900"
            }`}
          >
            In Stock Only
          </button>
        </SidebarSection>

        <SidebarSection title="Categories">
          <div className="flex flex-col gap-2">
            {dynamicCategories.length ? (
              dynamicCategories.map((c) => {
                const isActive = category === c;

                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    className={`inline-flex min-h-[42px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-vu-red text-white shadow-sm"
                        : "border border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 hover:bg-white hover:text-neutral-900"
                    }`}
                  >
                    {c}
                  </button>
                );
              })
            ) : (
              <div className="text-sm text-neutral-500">
                No categories available for current selection.
              </div>
            )}
          </div>
        </SidebarSection>

        <SidebarSection title="Groups">
          <div className="flex flex-col gap-2">
            {dynamicGroups.length ? (
              dynamicGroups.map((g) => {
                const isActive = group === g;

                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGroup(g)}
                    className={`inline-flex min-h-[42px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-vu-red text-white shadow-sm"
                        : "border border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 hover:bg-white hover:text-neutral-900"
                    }`}
                  >
                    {g}
                  </button>
                );
              })
            ) : (
              <div className="text-sm text-neutral-500">
                No groups available for current selection.
              </div>
            )}
          </div>
        </SidebarSection>

        <SidebarSection title="Brands">
          <div className="flex flex-col gap-2">
            {(dynamicBrands.length ? dynamicBrands : BRANDS).map((b) => {
              const isActive = activeBrand === b.toLowerCase();

              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => toggleBrand(b)}
                  className={`inline-flex min-h-[42px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-vu-red text-white shadow-sm"
                      : "border border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 hover:bg-white hover:text-neutral-900"
                  }`}
                >
                  {b}
                </button>
              );
            })}
          </div>
        </SidebarSection>

        <SidebarSection title="Price Range">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                placeholder="Min"
                className="min-h-[44px] rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-900 outline-none transition focus:border-neutral-300 focus:bg-white"
              />

              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                placeholder="Max"
                className="min-h-[44px] rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-900 outline-none transition focus:border-neutral-300 focus:bg-white"
              />
            </div>

            <button
              type="button"
              onClick={applyPriceFilter}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
            >
              Apply Price
            </button>
          </div>
        </SidebarSection>
      </div>

      <div className="mt-6 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(false)}
          className="inline-flex min-h-[46px] w-full items-center justify-center rounded-2xl bg-vu-red px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
        >
          Done
        </button>
      </div>
    </>
  );

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center md:px-6">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
          <h1 className="text-2xl font-bold text-neutral-950 md:text-3xl">
            Products
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600 md:text-base">
            We could not load products right now. Please refresh the page and
            try again.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <div className="mb-8">
          <div className="h-10 w-52 animate-pulse rounded-2xl bg-neutral-200" />
          <div className="mt-3 h-5 w-80 animate-pulse rounded-xl bg-neutral-100" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[290px_1fr]">
          <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
            <div className="mb-4 h-6 w-24 animate-pulse rounded-xl bg-neutral-200" />
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-2xl bg-neutral-100"
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
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
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-950 md:text-4xl">
          Products
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 md:text-base">
          Explore premium Vape Ustad products with a clean shopping experience,
          clear pricing, and fast browsing by filters.
        </p>

        {(brand ||
          group ||
          category ||
          q ||
          minPrice ||
          maxPrice ||
          inStockOnly ||
          sort) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {brand ? <FilterChip label="Brand" value={brand} /> : null}
            {group ? <FilterChip label="Group" value={group} /> : null}
            {category ? <FilterChip label="Category" value={category} /> : null}
            {q ? <FilterChip label="Search" value={q} /> : null}
            {minPrice ? <FilterChip label="Min" value={minPrice} /> : null}
            {maxPrice ? <FilterChip label="Max" value={maxPrice} /> : null}
            {inStockOnly ? <FilterChip label="Stock" value="In Stock" /> : null}
            {sort === "price_asc" ? (
              <FilterChip label="Sort" value="Price Low to High" />
            ) : null}
            {sort === "price_desc" ? (
              <FilterChip label="Sort" value="Price High to Low" />
            ) : null}

            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700 transition hover:bg-neutral-50"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      <div className="mb-5 flex items-center gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-neutral-200 bg-white px-5 py-2 text-sm font-semibold text-neutral-900 shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition hover:bg-neutral-50"
        >
          Filters
        </button>

        <div className="text-sm text-neutral-500">
          {sorted.length} Product{sorted.length === 1 ? "" : "s"}
        </div>
      </div>

      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setMobileFiltersOpen(false)}
            className="absolute inset-0 bg-black/35"
          />
          <div className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-[#fefefe] shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-950">Filters</h2>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-neutral-500">
                  Refine products
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-lg text-neutral-700 transition hover:bg-neutral-50"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">{filtersContent}</div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[290px_1fr] lg:items-start">
        <aside className="hidden rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)] lg:sticky lg:top-24 lg:block">
          {filtersContent}
        </aside>

        <div>
          <div className="mb-5 flex flex-col gap-4 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.05)] md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-neutral-950">
                {sorted.length} Product{sorted.length === 1 ? "" : "s"} Found
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Sort products by price or keep the default ERP order.
              </p>
            </div>

            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Sort By
              </span>

              <select
                value={sort}
                onChange={(e) =>
                  updateFilters({
                    sort: e.target.value || null,
                  })
                }
                className="min-h-[44px] rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm font-medium text-neutral-900 outline-none transition focus:border-neutral-300 focus:bg-white"
              >
                <option value="">Default</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="rounded-[28px] border border-neutral-200 bg-white p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-2xl">
                🔍
              </div>
              <h3 className="mt-4 text-xl font-bold text-neutral-950">
                No products found
              </h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Try changing filters or clear the current selection to explore
                more items.
              </p>

              <button
                type="button"
                onClick={clearAll}
                className="mt-5 inline-flex min-h-[46px] items-center justify-center rounded-2xl bg-vu-red px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
              >
                View All Products
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {sorted.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="mt-8 rounded-[28px] border border-neutral-200 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.05)] md:p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-neutral-500">
                      Page{" "}
                      <span className="font-semibold text-neutral-900">
                        {currentPage}
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-neutral-900">
                        {totalPages}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage <= 1}
                        className="inline-flex min-h-[42px] items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Prev
                      </button>

                      {pageNumbers.map((pageNumber, index) => {
                        const prev = pageNumbers[index - 1];
                        const showEllipsis =
                          typeof prev === "number" && pageNumber - prev > 1;

                        return (
                          <div
                            key={pageNumber}
                            className="flex items-center gap-2"
                          >
                            {showEllipsis ? (
                              <span className="px-1 text-sm text-neutral-400">
                                …
                              </span>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => goToPage(pageNumber)}
                              className={`inline-flex h-[42px] min-w-[42px] items-center justify-center rounded-2xl px-3 text-sm font-semibold transition ${
                                currentPage === pageNumber
                                  ? "bg-vu-red text-white shadow-sm"
                                  : "border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
                              }`}
                            >
                              {pageNumber}
                            </button>
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        className="inline-flex min-h-[42px] items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-neutral-600">Loading…</div>
      }
    >
      <ProductsInner />
    </Suspense>
  );
}