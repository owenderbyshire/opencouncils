import type { Metadata } from "next";
import { committeeName } from "@/lib/committees";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Section } from "@/components/page-header";
import { BlockSkeleton } from "@/components/skeleton";
import { getMeeting, recentMeetingIds, type MeetingDetail } from "@/data/council";
import { absUrl, href, type Locale } from "@/i18n/config";
import { Rich } from "@/i18n/rich";
import { summaryMismatches } from "@/lib/summary";
import { formatDate, formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { councilMessages } from "@/i18n/messages/council";
import { pickText } from "@/i18n/pick";
import { getLocale } from "@/i18n/server";
import { councilName, liveCouncil, LIVE_COUNCILS, type CouncilConfig } from "@/lib/councils";
import { excerpt, pageMetadata } from "@/lib/metadata";
import { meetingUrl } from "@/lib/official-urls";
import { issuesForMeeting } from "@/data/issues";
import { SHOW_ISSUES } from "@/lib/features";
import { issueMessages } from "@/i18n/messages/issues";
import { FollowLinks } from "@/components/follow-links";
import { TakePart } from "@/components/take-part";
import { engageMessages } from "@/i18n/messages/engage";
import { atLeastOne } from "@/lib/params";
import { partyColour, partyName } from "@/lib/parties";
import { tidyMinute, tidyTitle } from "@/lib/agenda";
import { councilFrom, idFrom, isId } from "@/lib/route";

type Params = Promise<{ council: string; id: string }>;

export async function generateStaticParams() {
  const out = [];
  for (const c of LIVE_COUNCILS) for (const id of await recentMeetingIds(c.id, 3)) out.push({ council: c.id, id: String(id) });
  return atLeastOne(out, { council: LIVE_COUNCILS[0]?.id ?? "cardiff", id: "0" });
}

export async function generateMetadata({ params }: PageProps<"/[lang]/[council]/meetings/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { council, id } = await params;
  const c = liveCouncil(council);
  const m = c && isId(id) ? await getMeeting(c.id, Number(id)) : null;
  if (!c || !m) return { title: common[locale].notFound.title };
  const name = committeeName(locale, m.committeeEn, m.committeeCy).text;
  const overview = pickText(locale, m.summary?.overviewEn, m.summary?.overviewCy).text;
  return pageMetadata({
    locale,
    path: `/${c.id}/meetings/${m.id}`,
    title: `${name}, ${formatDate(locale, m.date)}`,
    description: excerpt(overview || `${name}, ${councilName(locale, c)}, ${formatDate(locale, m.date)}`),
  });
}

async function meetingFor(params: Params): Promise<{ c: CouncilConfig; m: MeetingDetail }> {
  const c = await councilFrom(params);
  const m = await getMeeting(c.id, idFrom((await params).id));
  if (!m) notFound();
  return { c, m };
}

export default async function MeetingPage({ params }: PageProps<"/[lang]/[council]/meetings/[id]">) {
  const locale = await getLocale();
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={12} label={common[locale].words.loading} />}>
        <Meeting locale={locale} params={params} />
      </Suspense>
    </div>
  );
}

async function Meeting({ locale, params }: { locale: Locale; params: Params }) {
  const { c, m } = await meetingFor(params);
  const t = councilMessages[locale];
  const name = committeeName(locale, m.committeeEn, m.committeeCy);
  const official = m.sourceUrl ?? meetingUrl(c, m.id, locale);
  const summarised = ["council", "cabinet", "scrutiny", "planning"].includes(m.kind);
  return (
    <>
      <PageHeader
        kicker={<time dateTime={m.date}>{formatDate(locale, m.date, "weekday")}</time>}
        title={<span lang={name.lang}>{name.text}</span>}
      >
        <dl className="grid max-w-[60ch] grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-small">
          {m.startTime ? (
            <>
              <dt className="text-ink-2">{t.meeting.time}</dt>
              <dd className="num">{m.startTime}</dd>
            </>
          ) : null}
          {m.location ? (
            <>
              <dt className="text-ink-2">{t.meeting.location}</dt>
              <dd>{m.location}</dd>
            </>
          ) : null}
          <dt className="text-ink-2">{common[locale].words.source}</dt>
          <dd>{official ? <a href={official}>{t.meeting.officialPage}</a> : null}</dd>
          {m.papers.length ? (
            <>
              <dt className="text-ink-2">{t.meeting.papers}</dt>
              <dd>
                {m.papers.map((d, i) => (
                  <span key={d.id}>
                    {i ? ", " : ""}
                    <a href={d.url} lang={locale === "cy" ? "en" : undefined}>
                      {d.title}
                    </a>
                  </span>
                ))}
              </dd>
            </>
          ) : null}
          {m.recordingUrl ? (
            <>
              <dt className="text-ink-2">{t.meeting.recording}</dt>
              <dd>
                <a href={m.recordingUrl} rel="noopener">
                  {t.meeting.watch}
                </a>
              </dd>
            </>
          ) : null}
        </dl>
        {m.cancelled ? <p className="mt-4 font-semibold">{t.meeting.cancelledNote}</p> : null}
      </PageHeader>

      <Section
        id="summary"
        title={m.summary?.mode === "preview" ? t.meeting.previewTitle : t.meeting.summaryTitle}
        className="border-t border-rule"
      >
        {m.summary ? (
          <Summary locale={locale} m={m} />
        ) : m.items.some((i) => i.decision) ? (
          <Recorded locale={locale} m={m} />
        ) : (
          <p className="max-w-[62ch] text-ink-2">
            {m.status === "minuted" ? t.meetings.minutedNoSummary : summarised ? t.meeting.noSummaryYet : t.meeting.notSummarised}
          </p>
        )}
      </Section>

      <Section id="agenda" title={t.meeting.agendaTitle} className="border-t border-rule">
        <Agenda locale={locale} m={m} issues={SHOW_ISSUES ? new Map((await issuesForMeeting(c.id, m.id)).map((x) => [x.agendaItemId, x])) : new Map()} />
      </Section>

      {m.cancelled ? null : (
        <Section id="take-part" title={engageMessages[locale].title} className="border-t border-rule">
          <TakePart locale={locale} kind={m.kind} settled={m.minutesPublished} official={official} />
        </Section>
      )}

      <Section id="declarations" title={t.meeting.declarationsTitle} className="border-t border-rule">
        <p className="-mt-1 mb-4 max-w-[62ch] text-small text-ink-2">{t.meeting.declarationsLede}</p>
        <Declarations locale={locale} c={c} m={m} />
      </Section>

      <Section id="attendance" title={t.meeting.attendanceTitle} className="border-t border-rule">
        <Attendance locale={locale} c={c} m={m} />
        <p className="mt-3 max-w-[62ch] text-small text-ink-2">{t.meeting.attendanceScope}</p>
      </Section>

      <Section id="follow" title={engageMessages[locale].followTitle} className="border-t border-rule">
        <FollowLinks locale={locale} ics={`/feeds/${c.id}-committee-${m.committeeId}.ics`} />
      </Section>
    </>
  );
}

/** No summary yet, but the minutes record decisions: show them as written. */
function Recorded({ locale, m }: { locale: Locale; m: MeetingDetail }) {
  const t = councilMessages[locale].meeting;
  return (
    <>
      <p className="max-w-[62ch] text-small text-ink-2">{t.recordedNote}</p>
      <ol className="rows mt-4 max-w-[72ch]">
        {m.items
          .filter((i) => i.decision)
          .map((i) => (
            <li key={i.id} className="py-4">
              <h3 className="font-sans text-body font-semibold" lang={locale === "cy" ? "en" : undefined}>
                <a href={`#item-${i.id}`} className="link-quiet">
                  {tidyTitle(i.title)}
                </a>
              </h3>
              <p className="mt-1 whitespace-pre-line text-small" lang={locale === "cy" ? "en" : undefined}>
                {tidyMinute(i.decision!)}
              </p>
            </li>
          ))}
      </ol>
    </>
  );
}

function Summary({ locale, m }: { locale: Locale; m: MeetingDetail }) {
  const t = councilMessages[locale].meeting;
  const s = m.summary!;
  const preview = s.mode === "preview";
  const overview = pickText(locale, s.overviewEn, s.overviewCy);
  const docs = new Map(m.items.flatMap((i) => i.documents).map((d) => [d.id, d]));
  // Summaries written before English and Welsh were checked together can be shorter in one language.
  const shorter = summaryMismatches(s).some((x) => (locale === "cy" ? x.cy < x.en : x.en < x.cy));
  return (
    <>
      <p className="prose-read" lang={overview.lang}>
        {overview.text}
      </p>
      {shorter ? (
        <p className="mt-3 max-w-[62ch] border-l-2 border-rule-strong pl-3 text-small">
          <Rich text={t.partLost} links={{ other: absUrl(locale === "cy" ? "en" : "cy", `/${m.councilId}/meetings/${m.id}`) }} />
        </p>
      ) : null}

      <ol className="mt-6 rows max-w-[72ch]">
        {s.items.map((it) => {
          // The grounding check can remove a whole headline; the agenda title stands in, so no heading is left empty.
          const title = m.items.find((i) => i.id === it.agendaItemId)?.title;
          const written = pickText(locale, it.headlineEn, it.headlineCy);
          const headline = written.text || !title ? written : { text: tidyTitle(title), lang: locale === "cy" ? ("en" as const) : undefined };
          const decided = pickText(locale, it.decidedEn, it.decidedCy);
          const proposed = pickText(locale, it.proposedEn, it.proposedCy);
          const why = pickText(locale, it.whyEn, it.whyCy);
          const sources = it.sources.map((id) => docs.get(id)).filter((d) => d !== undefined);
          return (
            <li key={it.agendaItemId} className="py-5">
              <h3 className="text-h4" lang={headline.lang}>
                {headline.text}
              </h3>
              <dl className="mt-2 space-y-2">
                {preview ? (
                  proposed.text ? (
                    <div>
                      <dt className="text-small font-semibold">{t.proposed}</dt>
                      <dd lang={proposed.lang}>{proposed.text}</dd>
                    </div>
                  ) : null
                ) : (
                  <div>
                    <dt className="text-small font-semibold">{t.decided}</dt>
                    <dd lang={decided.lang}>{decided.text || <span className="text-ink-2">{t.noDecision}</span>}</dd>
                  </div>
                )}
                {why.text ? (
                  <div>
                    <dt className="text-small font-semibold">{t.why}</dt>
                    <dd lang={why.lang}>{why.text}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-2 text-meta text-ink-2">
                {t.basedOn}{" "}
                <a href={`#item-${it.agendaItemId}`}>{t.minutesOnly}</a>
                {sources.map((d) => (
                  <span key={d.id}>
                    {", "}
                    <a href={d.url} rel="noopener" lang={locale === "cy" ? "en" : undefined}>
                      {d.title}
                    </a>
                  </span>
                ))}
              </p>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 max-w-[62ch] text-meta text-ink-2">{preview ? t.previewNote : t.summaryNote}</p>
    </>
  );
}

function Agenda({ locale, m, issues }: { locale: Locale; m: MeetingDetail; issues: Map<number, { issueId: number; steps: number }> }) {
  const t = councilMessages[locale].meeting;
  const it = issueMessages[locale];
  if (!m.items.length) return <p className="text-ink-2">{t.agendaNone}</p>;
  return (
    <ol className="rows">
      {m.items.map((i) => (
        <li key={i.id} id={`item-${i.id}`} className="grid gap-x-6 py-4 sm:grid-cols-[3rem_1fr]">
          <span className="text-small text-ink-2 num">{i.number}</span>
          <div className="min-w-0 max-w-[72ch]">
            {/* Agenda titles and minutes are published in English only by most councils. */}
            <h3 className="font-sans text-body font-semibold" lang={locale === "cy" ? "en" : undefined}>
              {tidyTitle(i.title)}
            </h3>
            {i.decision ? (
              <div className="mt-2">
                <p className="text-small font-semibold">{t.recordedDecision}</p>
                <p className="whitespace-pre-line text-small" lang={locale === "cy" ? "en" : undefined}>
                  {i.decision}
                </p>
              </div>
            ) : null}
            {i.minutes ? (
              <details className="mt-2 text-small">
                <summary className="cursor-pointer text-ink-2">{t.minuteLabel}</summary>
                <p className="mt-2 whitespace-pre-line" lang={locale === "cy" ? "en" : undefined}>
                  {i.minutes}
                </p>
              </details>
            ) : null}
            {issues.get(i.id) ? (
              <p className="mt-2 text-small">
                <Link href={href(locale, `/${m.councilId}/issues/${issues.get(i.id)!.issueId}`)}>
                  {it.partOf.replace("{n}", formatNumber(locale, issues.get(i.id)!.steps))}
                </Link>
              </p>
            ) : null}
            {i.documents.length ? (
              <div className="mt-2 text-small">
                <span className="text-ink-2">{t.papers}: </span>
                {i.documents.map((d, n) => (
                  <span key={d.id}>
                    {n ? ", " : ""}
                    <a href={d.url} rel="noopener" lang={locale === "cy" ? "en" : undefined}>
                      {d.title}
                    </a>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Declarations({ locale, c, m }: { locale: Locale; c: CouncilConfig; m: MeetingDetail }) {
  const t = councilMessages[locale];
  if (!m.declarations.length)
    return <p className="text-ink-2">{m.summary && m.hasDeclarationsMinute ? t.meeting.declarationsNone : t.meeting.declarationsUnread}</p>;
  return (
    <ul className="rows max-w-[72ch]">
      {m.declarations.map((d, i) => {
        const nature = pickText(locale, d.natureEn, d.natureCy);
        return (
          <li key={i} className="py-3">
            <p>
              <span className="font-semibold">
                {d.councillorId ? <Link href={href(locale, `/${c.id}/councillors/${d.councillorId}`)}>{d.name}</Link> : d.name}
              </span>
              {": "}
              {t.declarationKinds[d.kind as keyof typeof t.declarationKinds] ?? t.declarationKinds.other}
              {d.item && d.agendaItemId ? (
                <>
                  {" "}
                  <a href={`#item-${d.agendaItemId}`}>
                    {t.meeting.declarationOn.split("{item}")[0]}
                    {/* Agenda titles are English only: mark them on Welsh pages. */}
                    <span lang={locale === "cy" ? "en" : undefined}>{d.item}</span>
                    {t.meeting.declarationOn.split("{item}")[1]}
                  </a>
                </>
              ) : null}
            </p>
            {nature.text ? (
              <p className="text-small text-ink-2" lang={nature.lang}>
                {nature.text}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function Attendance({ locale, c, m }: { locale: Locale; c: CouncilConfig; m: MeetingDetail }) {
  const t = councilMessages[locale];
  if (!m.attendance.length) return <p className="text-ink-2">{t.meeting.attendanceNone}</p>;
  return (
    <ul className="grid gap-x-10 gap-y-2 text-small sm:grid-cols-2 lg:grid-cols-3">
      {m.attendance.map((a) => (
        <li key={a.councillorId} className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: partyColour(a.partyId, a.partyLabel) }}
          />
          <span>
            <Link href={href(locale, `/${c.id}/councillors/${a.councillorId}`)}>{a.name}</Link>
            {a.role && !/^member$/i.test(a.role) ? `, ${a.role}` : ""}
            <span className="block text-ink-2">{partyName(locale, a.partyId, a.partyLabel)}</span>
            <span className="block">{t.attendance[a.status]}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
