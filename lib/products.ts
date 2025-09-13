export type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;    // PKR
  image: string;    // /products/...
  description: string;
};

export const products: Product[] = [
  { id: "p1", slug: "tokyo-refill",   name: "Tokyo Refill",        price: 1200,  image: "/products/tokyo-refill.jpg", description: "Smooth and balanced refill experience." },
  { id: "p2", slug: "oxva-xlim-0-4",  name: "Oxva Xlim 0.4",       price: 1800,  image: "/products/oxva-xlim.jpg",     description: "High performance coil for rich flavor." },
  { id: "p3", slug: "uwell-g3-pro",   name: "Uwell Caliburn G3 Pro", price: 14500, image: "/products/uwell-g3.jpg",     description: "Sleek device with pro features." },
  { id: "p4", slug: "drip-down",      name: "Drip Down",           price: 2200,  image: "/products/drip-down.jpg",     description: "Premium e-liquid with bold notes." },
];

export function getBySlug(slug: string) {
  return products.find(p => p.slug === slug);
}
