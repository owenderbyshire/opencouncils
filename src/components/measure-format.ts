import type { Locale } from "@/i18n/config";
import { formatDate, formatNumber, formatPercent } from "@/i18n/format";
import type { MeasureValues } from "@/lib/scores";
import { performanceMessages } from "@/i18n/messages/performance";

export function periodLabel(locale: Locale, p: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(p) ? formatDate(locale, p) : p;
}

/** A figure with its unit. Rates say what they are per ("33 per 10,000 people"). */
export function showValue(locale: Locale, unit: MeasureValues["unit"], v: number, per?: number, perOf?: MeasureValues["perOf"]): string {
  if (unit === "rate" && per)
    return performanceMessages[locale][perOf === "children" ? "perChildren" : "perPeople"]
      .replace("{v}", formatNumber(locale, Math.round(v * 10) / 10))
      .replace("{per}", formatNumber(locale, per));
  switch (unit) {
    case "percent":
      return formatPercent(locale, v / 100);
    case "share":
      return formatPercent(locale, v);
    case "money":
      // Large sums in millions, to one decimal place: "£3.4 million".
      // A minus sign before the pound sign: "−£4,000".
      return (
        (v < 0 ? "−" : "") +
        (Math.abs(v) >= 1e6
          ? performanceMessages[locale].millions.replace("{n}", formatNumber(locale, Math.round(Math.abs(v) / 1e5) / 10, 1))
          : `£${formatNumber(locale, Math.round(Math.abs(v)))}`)
      );
    case "days":
      return formatNumber(locale, Math.round(v));
    default:
      return formatNumber(locale, Math.round(v * 10) / 10);
  }
}

