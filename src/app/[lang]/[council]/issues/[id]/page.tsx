import { SHOW_ISSUES } from "@/lib/features";
import type { Metadata } from "next";
import { committeeName } from "@/lib/committees";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Section } from "@/components/page-header";
import { BlockSkeleton } from "@/components/skeleton";
import { getIssue, someIssueIds } from "@/data/issues";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { issueMessages } from "@/i18n/messages/issues";
import { pickText } from "@/i18n/pick";
import { getLocale } from "@/i18n/server";
import { councilName, liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { atLeastOne } from "@/lib/params";
import { councilFrom, idFrom, isId } from "@/lib/route";

/* One issue: every meeting that dealt with it, in order, with what each decided. */

type Params = Promise<{ council: string; id: string }>;

export async function generateStaticParams() {
  return atLeastOne(await someIssueIds(3), { council: "cardiff", id: "0" });
}

export async function generateMetadata({ params }: PageProps<"/[lang]/[council]/issues/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { council, id } = await params;
  const c = liveCouncil(council);
  const i = c && isId(id) ? await getIssue(c.id, Number(id)) : null;
  if (!c || !i) return { title: common[locale].notFound.title };
  const title = locale === "cy" && i.titleCy ? i.titleCy : i.titleEn;
  return pageMetadata({ locale, path: `/${c.id}/issues/${i.id}`, title, description: `${councilName(locale, c)}: ${issueMessages[locale].timelineTitle}` });
}

export default async function IssuePage({ params }: PageProps<"/[lang]/[council]/issues/[id]">) {
  if (!SHOW_ISSUES) notFound();
  const locale = await getLocale();
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={12} label={common[locale].words.loading} />}>
        <Issue locale={locale} params={params} />
      </Suspense>
    </div>
  );
}

async function Issue({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  const issue = await getIssue(c.id, idFrom((await params).id));
  if (!issue) notFound();
  const t = issueMessages[locale];
  const welsh = locale === "cy" && issue.titleCy;
  return (
    <>
      <PageHeader
        kicker={`${councilName(locale, c)}, ${t.steps.replace("{n}", formatNumber(locale, issue.steps))}`}
        title={<span lang={locale === "cy" && !welsh ? "en" : undefined}>{welsh ? issue.titleCy : issue.titleEn}</span>}
        lede={issue.decided ? t.decidedNote : t.openNote}
      />
      <Section id="timeline" title={t.timelineTitle} className="border-t border-rule">
        <ol className="relative max-w-[56rem] border-l-2 border-rule pl-6">
          {issue.stepsList.map((s) => {
            const committee = committeeName(locale, s.committeeEn, s.committeeCy);
            const headline = pickText(locale, s.headlineEn, s.headlineCy);
            const decided = pickText(locale, s.decidedEn, s.decidedCy);
            return (
              <li key={s.agendaItemId} className="relative pb-8 last:pb-0">
                <span aria-hidden="true" className="absolute top-1.5 -left-[31px] h-3 w-3 rounded-full border-2 border-bg bg-ink" />
                <p className="text-meta text-ink-2">
                  <time dateTime={s.date}>{formatDate(locale, s.date)}</time>
                </p>
                <h3 className="mt-0.5 text-h4">{s.upcoming ? (t.stageDue[s.kind] ?? t.stageDue.other) : (t.stage[s.kind] ?? t.stage.other)}</h3>
                <p className="text-small text-ink-2">
                  <span lang={committee.lang}>{committee.text}</span>
                  {t.stageNote[s.kind] ? `. ${t.stageNote[s.kind]}` : ""}
                </p>
                <p className="mt-2 font-semibold" lang={headline.text ? headline.lang : locale === "cy" ? "en" : undefined}>
                  {headline.text || s.title}
                </p>
                {decided.text ? (
                  <div className="mt-1">
                    <p className="text-meta text-ink-2">{t.summary}</p>
                    <p className="max-w-[62ch]" lang={decided.lang}>
                      {decided.text}
                    </p>
                  </div>
                ) : s.decision ? (
                  <div className="mt-1">
                    <p className="text-meta text-ink-2">{t.recorded}</p>
                    <p className="max-w-[62ch] text-small" lang={locale === "cy" ? "en" : undefined}>
                      {s.decision.length > 600 ? `${s.decision.slice(0, 600)}…` : s.decision}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-small text-ink-2">{s.minutesPublished ? t.noOutcome : t.proposed}</p>
                )}
                <p className="mt-2 text-small">
                  <Link href={href(locale, `/${c.id}/meetings/${s.meetingId}#item-${s.agendaItemId}`)}>{t.openMeeting}</Link>
                </p>
              </li>
            );
          })}
        </ol>
      </Section>
      <Section id="how" title={t.howTitle} className="border-t border-rule">
        <p className="max-w-[62ch] text-small text-ink-2">{t.how}</p>
        <p className="mt-3 text-small">
          <Link href={`${href(locale, "/issues")}?council=${c.id}`}>{t.allIssues}</Link>
        </p>
      </Section>
    </>
  );
}
