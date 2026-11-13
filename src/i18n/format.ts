/**
 * Locale-aware formatting. Dates stored as YYYY-MM-DD are calendar dates with
 * no time zone, so they are formatted in UTC to stop them shifting a day.
 * Timestamps are shown in UK time.
 */
import { htmlLang, type Locale } from "./config";
import { andPlace } from "./welsh";

type DateStyle =
  | "long"
  | "short"
  | "weekday"
  | "weekdayDay"
  | "month"
  | "monthShort"
  | "monthName"
  | "dayMonth"
  | "year"
  | "time"
  | "monthAbbr"
  | "dayNumber"
  | "weekdayShort";

const OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { day: "numeric", month: "long", year: "numeric" },
  short: { day: "numeric", month: "short", year: "numeric" },
  weekday: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  weekdayDay: { weekday: "long", day: "numeric", month: "long" },
  monthName: { month: "long" },
  year: { year: "numeric" },
  month: { month: "long", year: "numeric" },
  monthShort: { month: "short", year: "numeric" },
  dayMonth: { day: "numeric", month: "short" },
  time: { hour: "2-digit", minute: "2-digit" },
  monthAbbr: { month: "short" },
  dayNumber: { day: "numeric" },
  weekdayShort: { weekday: "short" },
};

const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();

function dateFormatter(
  locale: Locale,
  style: DateStyle,
  timeZone: string,
): Intl.DateTimeFormat {
  const key = `d|${locale}|${style}|${timeZone}`;
  let f = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) {
    f = new Intl.DateTimeFormat(htmlLang(locale), {
      ...OPTIONS[style],
      timeZone,
    });
    cache.set(key, f);
  }
  return f;
}

function numberFormatter(
  locale: Locale,
  opts: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `n|${locale}|${JSON.stringify(opts)}`;
  let f = cache.get(key) as Intl.NumberFormat | undefined;
  if (!f) {
    f = new Intl.NumberFormat(htmlLang(locale), opts);
    cache.set(key, f);
  }
  return f;
}

/** Formats a calendar date ("2026-10-21") or a timestamp. */
export function formatDate(
  locale: Locale,
  value: string | Date | null | undefined,
  style: DateStyle = "long",
): string {
  if (!value) return "";
  if (typeof value === "string") {
    const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
    if (Number.isNaN(d.getTime())) return value;
    return dateFormatter(
      locale,
      style,
      value.length === 10 ? "UTC" : "Europe/London",
    ).format(d);
  }
  return dateFormatter(locale, style, "Europe/London").format(value);
}

export function formatNumber(
  locale: Locale,
  n: number | null | undefined,
  digits = 0,
): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  return numberFormatter(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(n);
}

/** "1.2 million" rather than "1,211,187" in running text; exact below a million. */
export function formatCompact(locale: Locale, n: number): string {
  if (Math.abs(n) < 1_000_000) return formatNumber(locale, n);
  const v = numberFormatter(locale, { maximumFractionDigits: 1 }).format(
    n / 1_000_000,
  );
  return locale === "cy" ? `${v} miliwn` : `${v} million`;
}

export function formatPercent(
  locale: Locale,
  share: number | null | undefined,
  digits = 0,
): string {
  if (share === null || share === undefined || Number.isNaN(share)) return "";
  return numberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(share);
}

export function formatMoney(
  locale: Locale,
  amount: number | null | undefined,
  digits = 2,
): string {
  if (amount === null || amount === undefined) return "";
  return numberFormatter(locale, {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(amount);
}

/**
 * Joins a short list in running text: "a, b and c" / "a, b a c".
 * Welsh uses "ac" before a vowel; Intl.ListFormat gets this wrong for Welsh.
 */
export function formatList(locale: Locale, items: string[], opts: { places?: boolean } = {}): string {
  if (items.length <= 1) return items[0] ?? "";
  const head = items.slice(0, -1).join(", ");
  const last = items[items.length - 1];
  if (locale === "cy") {
    // Place names take the aspirate mutation after "a": "Rhondda Cynon Taf a Thorfaen".
    if (opts.places) return `${head} ${andPlace(last)}`;
    const and = /^[aeiouwyâêîôûŵŷ]/i.test(last) ? "ac" : "a";
    return `${head} ${and} ${last}`;
  }
  return `${head} and ${last}`;
}

/** ISO date of "today" in the UK. */
export function ukToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
