import Link from "next/link";
import { committeeName } from "@/lib/committees";
import type { MeetingRow } from "@/data/council";
import { href, type Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { councilMessages } from "@/i18n/messages/council";
import { pickText } from "@/i18n/pick";
import { DateTile, KindIcon } from "./meeting-marks";

/** One meeting in a list: date, committee, and the summary's overview when there is one. */
export function MeetingItem({
  locale,
  row,
  showOverview = true,
  councilLabel,
}: {
  locale: Locale;
  row: MeetingRow;
  showOverview?: boolean;
  /** Shown above the committee when the list mixes councils. */
  councilLabel?: string;
}) {
  const t = councilMessages[locale].meetings;
  const name = committeeName(locale, row.committeeEn, row.committeeCy);
  // A preview is written from the agenda before the meeting ("Cabinet is due to
  // consider…"). Once the meeting has happened it reads as current when it isn't,
  // so the list says where the meeting stands instead. Its page still has it.
  const stalePreview = row.summaryMode === "preview" && row.status !== "upcoming";
  const overview = stalePreview ? { text: "", lang: undefined } : pickText(locale, row.overviewEn, row.overviewCy);
  // Meetings coming up get a date tile, so the next few dates stand out.
  const tile = row.status === "upcoming" && !row.cancelled;
  return (
    <article className={`grid gap-y-1 py-4 ${tile ? "grid-cols-[3.5rem_1fr] gap-x-4 sm:grid-cols-[8.5rem_1fr] sm:gap-x-6" : "gap-x-6 sm:grid-cols-[11rem_1fr]"}`}>
      {tile ? (
        <div className="flex items-start gap-3 text-small text-ink-2">
          <DateTile locale={locale} date={row.date} />
          {row.startTime ? <span className="hidden pt-1 num sm:block">{row.startTime}</span> : null}
        </div>
      ) : (
        <div className="text-small text-ink-2">
          <time dateTime={row.date}>{formatDate(locale, row.date, "weekday")}</time>
          {row.startTime ? <span className="block num">{row.startTime}</span> : null}
        </div>
      )}
      <div className="min-w-0">
        {councilLabel ? <p className="text-meta text-ink-2">{councilLabel}</p> : null}
        <h3 className="flex items-start gap-2 font-sans text-body font-semibold">
          <KindIcon kind={row.kind} className="mt-0.5" />
          <Link href={href(locale, `/${row.councilId}/meetings/${row.id}`)} lang={name.lang}>
            {name.text}
          </Link>
        </h3>
        {tile && row.startTime ? <p className="text-small text-ink-2 num sm:hidden">{row.startTime}</p> : null}
        {row.cancelled ? (
          <p className="text-small text-ink-2">{t.cancelled}</p>
        ) : showOverview && overview.text ? (
          <p className="mt-1 max-w-[70ch] text-small text-ink-2" lang={overview.lang}>
            {overview.text}
          </p>
        ) : showOverview && row.status === "awaiting" ? (
          <p className="mt-1 max-w-[70ch] text-small text-ink-2">{t.awaitingSummary}</p>
        ) : showOverview && row.status === "minuted" ? (
          <p className="mt-1 max-w-[70ch] text-small text-ink-2">{t.minutedNoSummary}</p>
        ) : null}
      </div>
    </article>
  );
}
