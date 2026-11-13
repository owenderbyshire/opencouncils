import type { CommitteeKind } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { Icon, type IconName } from "./icons";

/**
 * Small marks for meeting lists: a date tile for meetings coming up, and a
 * line icon for the four kinds of meeting that get summaries. Both are built
 * from the meeting's own date and committee kind; the icon is decorative,
 * since the committee's name beside it says what it is.
 */

/** A meeting's date as a tile: weekday, day and month. The full date is in the `time` element. */
export function DateTile({ locale, date }: { locale: Locale; date: string }) {
  return (
    <time
      dateTime={date}
      title={formatDate(locale, date, "weekday")}
      className="inline-grid w-14 shrink-0 justify-items-center rounded-sm border border-rule-strong bg-bg py-1 leading-none"
    >
      <span className="text-meta text-ink-2">{formatDate(locale, date, "weekdayShort")}</span>
      <span className="my-0.5 font-serif text-h3 font-semibold text-ink num">{formatDate(locale, date, "dayNumber")}</span>
      <span className="text-meta text-ink-2">{formatDate(locale, date, "monthAbbr")}</span>
    </time>
  );
}

const KINDS: Partial<Record<CommitteeKind, IconName>> = {
  council: "council",
  cabinet: "cabinet",
  scrutiny: "scrutiny",
  planning: "planning",
};

/** A line icon for a full Council, Cabinet, scrutiny or planning meeting; nothing for other committees. */
export function KindIcon({ kind, className = "" }: { kind: CommitteeKind; className?: string }) {
  const name = KINDS[kind];
  if (!name) return null;
  return <Icon name={name} className={`text-ink-2 ${className}`} />;
}
