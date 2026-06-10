"use client";

import { useMemo, useState } from "react";

type ImageGalleryProps = {
  images: string[];
  productName: string;
};

const DEFAULT_IMAGE = "/images/placeholder.png";

export default function ImageGallery({ images, productName }: ImageGalleryProps) {
  const galleryImages = useMemo(() => {
    const clean = images.filter(Boolean);
    return Array.from(new Set(clean.length ? clean : [DEFAULT_IMAGE]));
  }, [images]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const activeImage = galleryImages[activeIndex] || galleryImages[0] || DEFAULT_IMAGE;

  function showPrev() {
    setActiveIndex((current) =>
      current <= 0 ? galleryImages.length - 1 : current - 1
    );
  }

  function showNext() {
    setActiveIndex((current) =>
      current >= galleryImages.length - 1 ? 0 : current + 1
    );
  }

  return (
    <>
      <div className="flex h-full flex-col gap-4">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="group flex min-h-[520px] flex-1 items-center justify-center overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.06)] transition hover:border-neutral-300 lg:min-h-[640px]"
          aria-label={`Open ${productName} image`}
        >
          <div className="flex h-full w-full items-center justify-center bg-neutral-50 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage}
              alt={productName}
              className="max-h-full max-w-full object-contain transition duration-300 group-hover:scale-[1.015]"
            />
          </div>
        </button>

        {galleryImages.length > 1 ? (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
            {galleryImages.slice(0, 10).map((img, idx) => {
              const active = idx === activeIndex;

              return (
                <button
                  key={`${img}-${idx}`}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`overflow-hidden rounded-2xl border bg-white transition ${
                    active
                      ? "border-vu-red ring-2 ring-vu-red/15"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                  aria-label={`Show ${productName} image ${idx + 1}`}
                >
                  <div className="aspect-square bg-neutral-50 p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={`${productName} preview ${idx + 1}`}
                      className="h-full w-full object-contain"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {lightboxOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white px-4 py-2 text-sm font-bold text-neutral-900 shadow-lg transition hover:bg-neutral-100"
          >
            Close
          </button>

          {galleryImages.length > 1 ? (
            <>
              <button
                type="button"
                onClick={showPrev}
                className="absolute left-4 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/95 px-4 py-3 text-xl font-bold text-neutral-900 shadow-lg transition hover:bg-white md:block"
                aria-label="Previous image"
              >
                ←
              </button>

              <button
                type="button"
                onClick={showNext}
                className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/95 px-4 py-3 text-xl font-bold text-neutral-900 shadow-lg transition hover:bg-white md:block"
                aria-label="Next image"
              >
                →
              </button>
            </>
          ) : null}

          <div className="flex max-h-[90vh] max-w-[95vw] items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage}
              alt={productName}
              className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}