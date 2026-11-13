import Link from "next/link";
import type { IssueRow } from "@/data/issues";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";
import { issueMessages } from "@/i18n/messages/issues";
import { councilConfig, councilShort } from "@/lib/councils";

/** One issue in a list: its title, how many meetings, the span of dates and whether it's decided. */
export function IssueRowView({ locale, issue, showCouncil = true }: { locale: Locale; issue: IssueRow; showCouncil?: boolean }) {
  const t = issueMessages[locale];
  const c = councilConfig(issue.councilId);
  const welsh = locale === "cy" && issue.titleCy;
  return (
    <li className="py-4">
      <p className="text-meta text-ink-2">
        <span className={issue.decided ? "font-semibold text-ink" : ""}>{issue.decided ? t.decided : t.open}</span>
        {", "}
        {t.steps.replace("{n}", formatNumber(locale, issue.steps))}
        {", "}
        {t.from.replace("{first}", formatDate(locale, issue.firstDate, "short")).replace("{last}", formatDate(locale, issue.lastDate, "short"))}
        {showCouncil && c ? `, ${councilShort(locale, c)}` : ""}
      </p>
      <p className="mt-0.5">
        <Link href={href(locale, `/${issue.councilId}/issues/${issue.id}`)} className="font-semibold" lang={locale === "cy" && !welsh ? "en" : undefined}>
          {welsh ? issue.titleCy : issue.titleEn}
        </Link>
      </p>
    </li>
  );
}
