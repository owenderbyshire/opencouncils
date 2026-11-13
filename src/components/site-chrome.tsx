import Link from "next/link";
import { Suspense } from "react";
import { href, type Locale } from "@/i18n/config";
import { common } from "@/i18n/messages/common";
import { followMessages } from "@/i18n/messages/follow";
import { navMessages } from "@/i18n/messages/nav";
import { walesMessages } from "@/i18n/messages/wales";
import { Rich } from "@/i18n/rich";
import { SITE } from "@/lib/site";
import { BetaBanner } from "./beta-banner";
import { NavLink } from "./nav-link";
import { SidebarShell } from "./sidebar-shell";
import { ThemeSwitch } from "./theme-switch";
import { Icon, type IconName } from "./icons";
import { TileLogo } from "./tile-logo";

/** The lockup (docs/family-design.md): the tile and the wordmark on one line, centred on each other. */
function Wordmark({ locale, large = false }: { locale: Locale; large?: boolean }) {
  const t = common[locale];
  return (
    <Link
      href={href(locale, "/")}
      className={`inline-flex items-center text-ink no-underline ${large ? "gap-[10px]" : "gap-2"}`}
      aria-label={`${t.siteName}, ${t.nav.home}`}
    >
      <TileLogo size={large ? 36 : 28} />
      <span className={`font-serif leading-none font-semibold tracking-[-0.01em] ${large ? "text-[24px]" : "text-[18px]"}`}>
        {t.siteName}
      </span>
    </Link>
  );
}

/** Every sidebar link, with the paths of the links that sit beneath it, so only the closest one is marked current. */
function navItems(locale: Locale) {
  const sections = navMessages[locale].sections;
  const paths = sections.flatMap((s) => s.items.map((i) => i.path)).filter((p) => !p.includes("#"));
  return sections.map((s) => ({
    ...s,
    items: s.items.map((i) => ({
      ...i,
      href: href(locale, i.path),
      deeper: paths.filter((p) => p !== i.path && p.startsWith(`${i.path}/`)),
    })),
  }));
}

/** Each sidebar link's icon, from the family's line set. */
const NAV_ICONS: Record<string, IconName> = {
  "/councils": "council",
  "/reorganisation": "compare",
  "/find": "find",
  "/#councils": "council",
  "/performance": "performance",
  "/compare": "compare",
  "/elections#parties": "party",
  "/latest": "latest",
  "/issues": "issues",
  "/topics": "topics",
  "/search": "search",
  "/planning": "planning",
  "/planning/league": "league",
  "/planning/plans": "plans",
  "/elections": "elections",
  "/consultations": "consultations",
  "/follow": "follow",
  "/guide": "guide",
  "/about": "about",
  "/data": "data",
};

const linkClass =
  "group flex items-center gap-2.5 rounded-r border-l-2 border-transparent py-[0.3rem] pr-3 pl-3 text-small text-ink-2 no-underline hover:bg-surface hover:text-ink aria-[current=page]:border-accent-strong aria-[current=page]:bg-surface-2 aria-[current=page]:font-medium aria-[current=page]:text-ink";

function ItemLabel({ path, label }: { path: string; label: string }) {
  const icon = NAV_ICONS[path];
  return (
    <>
      {icon ? <Icon name={icon} size={18} className="text-ink-3 group-hover:text-ink-2 group-aria-[current=page]:text-accent-strong" /> : null}
      <span className="min-w-0">{label}</span>
    </>
  );
}

/** The navigation in labelled sections. `plain` leaves out the current-page marks (while the URL is not yet known). */
function SidebarNav({ locale, plain = false }: { locale: Locale; plain?: boolean }) {
  return (
    <nav aria-label={common[locale].nav.label} className="flex-1 space-y-4 px-3 py-4">
      {navItems(locale).map((s) => (
        <section key={s.id} aria-labelledby={`nav-${s.id}`}>
          <h2 id={`nav-${s.id}`} className="mb-1 px-3.5 font-sans text-meta font-semibold text-ink-3">
            {s.label}
          </h2>
          <ul>
            {s.items.map((i) => (
              <li key={i.path}>
                {plain ? (
                  <Link href={i.href} className={linkClass}>
                    <ItemLabel path={i.path} label={i.label} />
                  </Link>
                ) : (
                  <NavLink href={i.href} path={i.path} deeper={i.deeper} className={linkClass}>
                    <ItemLabel path={i.path} label={i.label} />
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

function Sidebar({ locale }: { locale: Locale }) {
  const t = common[locale];
  return (
    <div className="flex h-full flex-col overflow-y-auto overscroll-contain">
      <div className="border-b border-rule px-5 pt-5 pb-4">
        <Wordmark locale={locale} large />
        {/* The tagline wraps rather than losing its last word: the Welsh one is longer than the sidebar. */}
        <p className="mt-2 text-meta text-balance text-ink-3">{t.footer.family.opencouncil.note}</p>
      </div>
      <Suspense fallback={<SidebarNav locale={locale} plain />}>
        <SidebarNav locale={locale} />
      </Suspense>
      <div className="sticky bottom-0 mt-auto flex items-center justify-between gap-3 border-t border-rule bg-bg px-6 py-3">
        <ThemeSwitch label={navMessages[locale].darkMode} />
      </div>
    </div>
  );
}

/** A plain GET form, so every search has a URL and works without JavaScript. */
function TopSearch({ locale }: { locale: Locale }) {
  const t = walesMessages[locale].search;
  const n = navMessages[locale];
  return (
    <>
      <form action={href(locale, "/search")} method="get" role="search" className="hidden w-full max-w-[26rem] sm:block">
        <label htmlFor="site-q" className="visually-hidden">
          {t.label}
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input
            id="site-q"
            name="q"
            type="search"
            className="field min-h-9 py-1.5 pl-9 text-small"
            placeholder={t.placeholder}
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
      </form>
      <Link
        href={href(locale, "/search")}
        aria-label={n.search}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded text-ink no-underline hover:bg-surface sm:hidden"
      >
        <SearchIcon />
      </Link>
    </>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * The frame around every page: the sidebar, the top bar, then the page and
 * its footer. On phones without JavaScript, the menu button leads to the
 * list of the same links at the foot of the page.
 */
export function SiteFrame({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const n = navMessages[locale];
  return (
    <SidebarShell
      labels={{ menu: n.menu, close: n.close, siteMenu: n.siteMenu }}
      menuHref="#site-menu"
      sidebar={<Sidebar locale={locale} />}
      banner={<BetaBanner locale={locale} />}
      topBar={
        <>
          <div className="mr-auto pl-1 lg:hidden">
            <Wordmark locale={locale} />
          </div>
          <TopSearch locale={locale} />
        </>
      }
    >
      {children}
      <SiteFooter locale={locale} />
      <FootMenu locale={locale} />
    </SidebarShell>
  );
}

/** The sidebar's links as a list at the foot of the page, for phones without JavaScript. */
function FootMenu({ locale }: { locale: Locale }) {
  const n = navMessages[locale];
  return (
    <nav id="site-menu" aria-label={n.siteMenu} className="no-js-only border-t border-rule lg:hidden">
      <div className="container-page grid gap-6 py-8 sm:grid-cols-2">
        {navItems(locale).map((s) => (
          <section key={s.id}>
            <h2 className="mb-1 font-sans text-meta font-semibold text-ink-3">{s.label}</h2>
            <ul className="space-y-1 text-small">
              {s.items.map((i) => (
                <li key={i.path}>
                  <Link href={i.href}>{i.label}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = common[locale];
  const f = t.footer;
  return (
    <footer className="mt-16 border-t border-rule bg-surface">
      <div className="container-page grid gap-8 py-10 text-small text-ink-2 md:grid-cols-[1fr_auto]">
        <div className="max-w-[60ch] space-y-3">
          <p className="flex items-center gap-2 font-serif text-h4 font-semibold text-ink">
            <TileLogo size={28} />
            {t.siteName}
          </p>
          <p>{f.independent}</p>
          <p>
            {f.licence}{" "}
            <a href={f.licenceUrl} rel="license noopener">
              {f.licenceLink}
            </a>
            . <Rich text={f.otherRights} links={{ data: href(locale, "/data") }} />
          </p>
        </div>
        <ul className="grid content-start gap-1.5">
          <li>
            <Link href={href(locale, "/follow")}>{followMessages[locale].title}</Link>
          </li>
          <li>
            <Link href={href(locale, "/about")}>{f.about}</Link>
          </li>
          <li>
            <a href={`mailto:${SITE.contactEmail}`}>{f.contact}</a>
          </li>
        </ul>
      </div>
      <FamilyFooter locale={locale} />
    </footer>
  );
}

/**
 * OpenCouncils stands alone (decided 13 November 2026): no Open family list
 * and no Edau link, only the publisher and a light link to the Welsh sister site.
 */
export function FamilyFooter({ locale }: { locale: Locale }) {
  const f = common[locale].footer;
  return (
    <div className="border-t border-rule">
      <div className="container-page py-6 text-small text-ink-2">
        <p>
          {f.publishedBy}{" "}
          <a href={SITE.publisher.url} rel="noopener">
            {SITE.publisher.name}
          </a>
          . <Rich text={f.sisterNote} links={{ sister: SITE.sister.url }} />
        </p>
      </div>
    </div>
  );
}
