"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    const orientation = screen.orientation as (ScreenOrientation & { lock?: (orientation: string) => Promise<void> }) | undefined;

    if (orientation?.lock) {
      orientation.lock("portrait").catch(() => undefined);
    }

    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js").then((registration) => {
      registration.update().catch(() => undefined);
    });
  }, []);

  return null;
}
