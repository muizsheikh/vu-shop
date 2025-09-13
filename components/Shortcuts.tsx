"use client";
import { useEffect, useState } from "react";

export default function Shortcuts() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F1") { e.preventDefault(); setOpen(o => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(90vw,700px)] rounded-2xl border border-white/10 bg-[var(--bg)] text-[var(--fg)] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Keyboard Shortcuts</h2>
          <button className="px-3 py-2 rounded-xl border border-white/20" onClick={() => setOpen(false)}>Close</button>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Shortcut k="F1" d="Toggle this help" />
          <Shortcut k="C" d="Open/Close cart" />
          <Shortcut k="/" d="(future) Focus search" />
          <Shortcut k="D" d="(future) Toggle dark mode" />
        </div>
      </div>
    </div>
  );
}
function Shortcut({ k, d }: { k: string; d: string }) {
  return (
    <div className="flex items-center justify-between border border-white/10 rounded-xl p-3">
      <kbd className="px-2 py-1 rounded-md bg-white/10 font-mono">{k}</kbd>
      <span className="opacity-80">{d}</span>
    </div>
  );
}
