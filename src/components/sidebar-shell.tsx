"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const WIDE = "(min-width: 64rem)";
const noop = () => () => {};

/**
 * The page frame from docs/family-design.md: a fixed sidebar on wide screens,
 * and on narrow screens a 56px top bar whose menu button opens the same
 * sidebar as a drawer. The sidebar, top bar and page arrive already rendered
 * on the server; this component only opens and closes the drawer.
 *
 * Without JavaScript the menu button is a link to the list at the foot of the page (`menuHref`).
 */
export function SidebarShell({
  labels,
  menuHref,
  sidebar,
  banner,
  topBar,
  children,
}: {
  labels: { menu: string; close: string; siteMenu: string };
  menuHref: string;
  sidebar: React.ReactNode;
  /** Shown above the top bar, beside the sidebar on wide screens (the beta notice). */
  banner?: React.ReactNode;
  topBar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  const refocus = useRef(false);

  const close = useCallback(() => {
    refocus.current = true;
    setOpen(false);
  }, []);

  // Once the page is no longer inert, put focus back on the menu button, so keyboard users don't lose their place.
  useEffect(() => {
    if (open || !refocus.current) return;
    refocus.current = false;
    menuButton.current?.focus();
  }, [open]);

  // Tell the CSS that JavaScript runs, so the no-JavaScript menu at the foot of the page can go.
  useEffect(() => {
    document.documentElement.dataset.js = "";
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // Following a link closes the drawer; so does widening the window until the sidebar shows.
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element).closest("a[href]")) setOpen(false);
    };
    const wide = window.matchMedia(WIDE);
    const onWide = () => wide.matches && setOpen(false);
    const el = panel.current;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    el?.addEventListener("click", onClick);
    wide.addEventListener("change", onWide);
    return () => {
      document.body.style.overflow = scroll;
      document.removeEventListener("keydown", onKey);
      el?.removeEventListener("click", onClick);
      wide.removeEventListener("change", onWide);
    };
  }, [open, close]);

  const menuIcon = (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
  const menuClass =
    "inline-flex size-10 shrink-0 items-center justify-center rounded text-ink no-underline hover:bg-surface lg:hidden";

  return (
    <>
      <aside
        ref={panel}
        id="sidebar"
        aria-label={labels.siteMenu}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        data-open={open ? "" : undefined}
        className="sidebar fixed inset-y-0 left-0 z-50 hidden w-72 max-w-[85vw] flex-col border-r border-rule bg-bg data-open:flex lg:z-30 lg:flex lg:w-64 lg:max-w-none"
      >
        {open ? (
          <button
            ref={closeButton}
            type="button"
            onClick={close}
            aria-label={labels.close}
            className="absolute top-3 right-3 inline-flex size-10 items-center justify-center rounded text-ink-2 hover:bg-surface hover:text-ink lg:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        ) : null}
        {sidebar}
      </aside>
      {open ? <div aria-hidden="true" onClick={close} className="fixed inset-0 z-40 bg-black/60 lg:hidden" /> : null}

      <div inert={open} className="flex min-h-dvh flex-col lg:pl-64">
        {banner}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-rule bg-bg px-2 sm:px-4 lg:px-8">
          {hydrated ? (
            <button
              ref={menuButton}
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="sidebar"
              aria-label={labels.menu}
              className={menuClass}
            >
              {menuIcon}
            </button>
          ) : (
            <a href={menuHref} aria-label={labels.menu} className={menuClass}>
              {menuIcon}
            </a>
          )}
          {topBar}
        </header>
        {children}
      </div>
    </>
  );
}
