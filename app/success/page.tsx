"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/store/cart";

export default function SuccessPage() {
  const clear = useCart((s) => s.clear);

  useEffect(() => {
    // Clear cart when success page loads
    clear();
    // Show simple success alert (toast lib not installed yet)
    alert("✅ Payment successful! Thank you for your order.");
  }, [clear]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <h1 className="text-3xl font-bold text-green-600">Payment Successful</h1>
      <p className="mt-3 text-gray-600">
        Your payment was received. We’ll process your order shortly.
      </p>
      <div className="mt-6 flex gap-4">
        <Link
          href="/products"
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Continue Shopping
        </Link>
        <Link
          href="/"
          className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
