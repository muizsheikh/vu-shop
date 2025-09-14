'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart';

export default function ClearCartOnSuccess() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const clear = useCartStore((s) => s.clear);
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    const sid = searchParams.get('session_id');
    if (!sid) return;

    const flag = `vu_cart_cleared_${sid}`;
    if (typeof window !== 'undefined' && !localStorage.getItem(flag)) {
      clear();
      localStorage.setItem(flag, '1');
      toast.success('Payment successful 🎉 Cart cleared.');
    }

    // optional: nudge home after a short delay
    const t = setTimeout(() => {
      // router.push('/'); // uncomment if you want auto-redirect
    }, 4500);
    once.current = true;
    return () => clearTimeout(t);
  }, [searchParams, clear, router]);

  return null;
}
