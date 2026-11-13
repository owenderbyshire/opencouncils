"use client";

import { useEffect, useSyncExternalStore } from "react";
import { THEME_KEY as KEY } from "@/lib/theme";

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const isDark = () => document.documentElement.dataset.theme === "dark";

/** The light and dark switch at the foot of the sidebar. It remembers the choice in this browser. */
/** A toggle button: pressed means dark mode is on. */
export function ThemeSwitch({ label }: { label: string }) {
  const on = useSyncExternalStore(subscribe, isDark, () => false);
  // The script in <head> applies a saved dark choice before the first paint. A page the server
  // sends as a bare shell, such as the 404 page for an unknown address, is drawn in the browser,
  // where that script never runs; apply the choice here so the page still follows it.
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "dark" || isDark()) return;
    } catch {
      return;
    }
    document.documentElement.dataset.theme = "dark";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#12181e");
    listeners.forEach((fn) => fn());
  }, []);
  const toggle = () => {
    const next = !on;
    const root = document.documentElement;
    if (next) root.dataset.theme = "dark";
    else delete root.dataset.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next ? "#12181e" : "#ffffff");
    try {
      if (next) localStorage.setItem(KEY, "dark");
      else localStorage.removeItem(KEY);
    } catch {
      // Private windows and blocked storage: the choice lasts for this page only.
    }
    listeners.forEach((fn) => fn());
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      className="js-only inline-flex min-h-9 items-center gap-2 rounded border border-rule-strong px-2.5 text-small text-ink hover:bg-surface"
    >
      <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {on ? (
          <>
            <circle cx="10" cy="10" r="3.5" />
            <path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3" />
          </>
        ) : (
          <path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z" />
        )}
      </svg>
      {label}
    </button>
  );
}
