import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { href } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";

/** Builds a query string from the current filters, dropping empty values and page 1. */
export function queryString(
  params: Record<string, string | number | undefined | null>,
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "page" && Number(v) <= 1) continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function Pagination({
  locale,
  path,
  page,
  total,
  pageSize,
  params = {},
}: {
  locale: Locale;
  path: string;
  page: number;
  total: number;
  pageSize: number;
  params?: Record<string, string | number | undefined | null>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const w = common[locale].words;
  const link = (p: number) =>
    href(locale, path) + queryString({ ...params, page: p });
  // A page number past the end (from an old link) offers a way back rather than "Page 999 of 79".
  if (page > pages) {
    return (
      <nav
        aria-label={`${w.page}`}
        className="mt-8 border-t border-rule pt-4 text-small"
      >
        <Link className="button button-quiet" href={link(pages)}>
          {w.page} {formatNumber(locale, pages)} {w.of}{" "}
          {formatNumber(locale, pages)}
        </Link>
      </nav>
    );
  }
  return (
    <nav
      aria-label={`${w.page}`}
      className="mt-8 flex items-center justify-between gap-4 border-t border-rule pt-4 text-small"
    >
      {page > 1 ? (
        <Link className="button button-quiet" href={link(page - 1)} rel="prev">
          {w.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-ink-2 num">
        {w.page} {formatNumber(locale, page)} {w.of}{" "}
        {formatNumber(locale, pages)}
      </span>
      {page < pages ? (
        <Link className="button button-quiet" href={link(page + 1)} rel="next">
          {w.next}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** A labelled row of mutually exclusive filter links. */
export function FilterGroup({
  label,
  options,
  current,
  locale,
  path,
  param,
  params = {},
}: {
  label: string;
  options: Array<{ value: string | undefined; label: string }>;
  current: string | undefined;
  locale: Locale;
  path: string;
  param: string;
  params?: Record<string, string | number | undefined | null>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-small text-ink-2">{label}</span>
      {options.map((o) => {
        const active = (o.value ?? "") === (current ?? "");
        return (
          <Link
            key={o.value ?? ""}
            className="chip"
            aria-current={active ? "true" : undefined}
            href={
              href(locale, path) +
              queryString({ ...params, [param]: o.value, page: undefined })
            }
            scroll={false}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
