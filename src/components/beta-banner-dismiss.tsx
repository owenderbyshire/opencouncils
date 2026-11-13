"use client";

import { useLayoutEffect } from "react";
import { BETA_BANNER_ATTR, BETA_BANNER_KEY } from "@/lib/beta-banner";

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])";

/** Moves focus to the first thing a reader can reach after `el`, so closing the notice by keyboard keeps their place. */
function focusAfter(el: Element) {
  for (const c of document.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (el.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING && !el.contains(c) && c.getClientRects().length > 0) {
      c.focus();
      return;
    }
  }
}

/** The beta notice's close button. It hides the notice at once and remembers that in this browser. */
export function BetaBannerDismiss({ label }: { label: string }) {
  // React's development remount clears attributes it did not set on <html>, including the one the
  // script in <head> set before the first paint, so set it again. In production this changes nothing.
  useLayoutEffect(() => {
    try {
      if (localStorage.getItem(BETA_BANNER_KEY) === "1") document.documentElement.setAttribute(BETA_BANNER_ATTR, "");
    } catch {
      // Storage switched off: nothing was saved.
    }
  }, []);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        const banner = e.currentTarget.closest("[data-beta-banner]");
        const hadFocus = document.activeElement === e.currentTarget;
        document.documentElement.setAttribute(BETA_BANNER_ATTR, "");
        try {
          localStorage.setItem(BETA_BANNER_KEY, "1");
        } catch {
          // Private windows and blocked storage: the notice comes back on the next visit.
        }
        if (hadFocus && banner) focusAfter(banner);
      }}
      className="-mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded text-ink-2 hover:bg-surface-2 hover:text-ink"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M3 3l8 8M11 3l-8 8" />
      </svg>
    </button>
  );
}
