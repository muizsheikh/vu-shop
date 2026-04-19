"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "age_verified";

type AgeGateState = "checking" | "required" | "verified";

export default function useAgeVerification() {
  const [state, setState] = useState<AgeGateState>("checking");

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      setState(saved === "true" ? "verified" : "required");
    } catch {
      setState("required");
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const shouldLock = state === "checking" || state === "required";
    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyTouchAction = body.style.touchAction;

    if (shouldLock) {
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
      body.style.touchAction = "none";
    }

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.touchAction = prevBodyTouchAction;
    };
  }, [state]);

  const accept = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
    setState("verified");
  }, []);

  const reject = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}

    // Best-effort: close if possible, otherwise redirect away.
    try {
      window.open("", "_self");
      window.close();
    } catch {}

    window.location.href = "https://www.google.com";
  }, []);

  return useMemo(
    () => ({
      isChecking: state === "checking",
      isRequired: state === "required",
      isVerified: state === "verified",
      accept,
      reject,
    }),
    [state, accept, reject]
  );
}