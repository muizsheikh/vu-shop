import { getBySlug } from "@/lib/products";
import { notFound } from "next/navigation";
import AddToCartButton from "./ui";

export const dynamic = "force-dynamic"; // runtime render, SSG off

export default function ProductDetail({ params }: { params: { slug: string } }) {
  const p = getBySlug(params.slug);
  if (!p) return notFound();

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={p.image}
        alt={p.name}
        className="w-full rounded-2xl object-cover border border-white/10"
      />

      <div>
        <h1 className="text-3xl font-extrabold">{p.name}</h1>
        <div className="mt-2 text-vu-red text-2xl font-bold">
          Rs {p.price.toLocaleString()}
        </div>
        <p className="mt-4 opacity-80 leading-relaxed">{p.description}</p>
        <div className="mt-6">
          <AddToCartButton p={p} />
        </div>
      </div>
    </div>
  );
}
