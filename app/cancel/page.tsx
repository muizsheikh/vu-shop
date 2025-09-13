"use client";

import Link from "next/link";

export default function CancelPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <h1 className="text-3xl font-bold text-red-600">Payment Cancelled</h1>
      <p className="mt-3 text-gray-600">
        Your payment was cancelled. You can try again anytime.
      </p>
      <div className="mt-6 flex gap-4">
        <Link
          href="/cart"
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Return to Cart
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
