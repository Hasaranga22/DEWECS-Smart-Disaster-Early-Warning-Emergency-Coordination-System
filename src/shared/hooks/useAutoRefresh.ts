"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `callback` every `intervalMs` while the tab is visible. The callback
 * always runs the latest closure (kept in a ref), so state changes never
 * re-create the interval. The first load is the page's own mount effect —
 * this hook only adds the background refresh.
 */
export function useAutoRefresh(callback: () => void | Promise<void>, intervalMs = 15_000): void {
  const ref = useRef(callback);
  ref.current = callback;

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void ref.current();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
}
