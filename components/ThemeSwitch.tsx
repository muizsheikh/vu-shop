"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = theme === "dark";
  return (
    <button
  aria-label="Toggle Dark Mode"
  className="inline-flex items-center justify-center rounded-xl h-9 px-4 py-2 text-sm font-medium border border-vu-red text-vu-red hover:bg-vu-red hover:text-white transition active:scale-95"
  onClick={() => setTheme(isDark ? "light" : "dark")}
>
  {isDark ? "Light" : "Dark"}
</button>


  );
}
