import type { Metadata } from "next";
import { committeeName } from "@/lib/committees";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Section } from "@/components/page-header";
import { BlockSkeleton } from "@/components/skeleton";
import { getCouncillor, someCouncillorIds, type CouncillorDetail } from "@/data/council";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatNumber, formatPercent } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { councilMessages } from "@/i18n/messages/council";
import { pickText } from "@/i18n/pick";
import { Rich } from "@/i18n/rich";
import { getLocale } from "@/i18n/server";
import { councilName, liveCouncil, LIVE_COUNCILS } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { councillorUrl } from "@/lib/official-urls";
import { atLeastOne } from "@/lib/params";
import { partyColour, partyName } from "@/lib/parties";
import { councilFrom, idFrom, isId } from "@/lib/route";

type Params = Promise<{ council: string; id: string }>;

export async function generateStaticParams() {
  const out = [];
  for (const c of LIVE_COUNCILS) for (const id of await someCouncillorIds(c.id, 3)) out.push({ council: c.id, id: String(id) });
  return atLeastOne(out, { council: LIVE_COUNCILS[0]?.id ?? "cardiff", id: "0" });
}

export async function generateMetadata({ params }: PageProps<"/[lang]/[council]/councillors/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { council, id } = await params;
  const c = liveCouncil(council);
  const p = c && isId(id) ? await getCouncillor(c.id, Number(id)) : null;
  if (!c || !p) return { title: common[locale].notFound.title };
  const ward = pickText(locale, p.wardEn, p.wardCy).text;
  return pageMetadata({
    locale,
    path: `/${c.id}/councillors/${p.id}`,
    title: `${p.name}, ${councilName(locale, c)}`,
    description: [partyName(locale, p.partyId, p.partyLabel), ward].filter(Boolean).join(", "),
  });
}

export default async function CouncillorPage({ params }: PageProps<"/[lang]/[council]/councillors/[id]">) {
  const locale = await getLocale();
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={10} label={common[locale].words.loading} />}>
        <Councillor locale={locale} params={params} />
      </Suspense>
    </div>
  );
}

async function Councillor({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  const p = await getCouncillor(c.id, idFrom((await params).id));
  if (!p) notFound();
  const t = councilMessages[locale];
  const w = common[locale].words;
  const ward = pickText(locale, p.wardEn, p.wardCy);
  const official = councillorUrl(c, p.id, locale) ?? p.sourceUrl;
  // The Vale of Glamorgan's committee membership comes from each councillor's own page (pipeline/jobs/vale.ts).
  const committeesKnown = c.system !== "vale" || p.officialAttendance !== null;
  // The Vale publishes its own attendance record per councillor; it is shown instead of OpenCouncil's partial count.
  const own = p.officialAttendance;
  const ownRows = own?.rows.filter((r) => r.held !== null && r.attended !== null) ?? [];
  const ownHeld = ownRows.reduce((n, r) => n + r.held!, 0);
  const ownAttended = ownRows.reduce((n, r) => n + r.attended!, 0);
  const roleLabel: Record<string, string> = {
    chair: t.committees.chair,
    "vice-chair": t.committees.viceChair,
    member: t.committees.member,
    substitute: t.committees.substitute,
    observer: t.committees.observer,
  };
  return (
    <>
      <PageHeader
        kicker={p.current ? w.councillor : w.formerCouncillor}
        title={p.honorific ? `${p.honorific} ${p.name}` : p.name}
        lede={p.current ? undefined : t.councillor.formerNote}
      >
        <dl className="grid max-w-[60ch] grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-small">
          {p.wardSlug ? (
            <>
              <dt className="text-ink-2">{t.councillor.wardLabel}</dt>
              <dd>
                <Link href={href(locale, `/${c.id}/wards/${p.wardSlug}`)} lang={ward.lang}>
                  {ward.text}
                </Link>
              </dd>
            </>
          ) : null}
          <dt className="text-ink-2">{t.councillor.partyLabel}</dt>
          <dd className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: partyColour(p.partyId, p.partyLabel) }} />
            {partyName(locale, p.partyId, p.partyLabel)}
          </dd>
          {p.keyPosts.length ? (
            <>
              <dt className="text-ink-2">{t.councillor.rolesLabel}</dt>
              <dd lang={locale === "cy" ? "en" : undefined}>{p.keyPosts.join("; ")}</dd>
            </>
          ) : null}
          {p.termStart ? (
            <>
              <dt className="text-ink-2">{t.councillor.since}</dt>
              <dd>{formatDate(locale, p.termStart)}</dd>
            </>
          ) : null}
          {p.email ? (
            <>
              <dt className="text-ink-2">{t.councillor.email}</dt>
              <dd>
                <a href={`mailto:${p.email}`}>{p.email}</a>
              </dd>
            </>
          ) : null}
          {p.phone ? (
            <>
              <dt className="text-ink-2">{t.councillor.phone}</dt>
              <dd>
                <a href={`tel:${p.phone.replace(/\s+/g, "")}`}>{p.phone}</a>
              </dd>
            </>
          ) : null}
          <dt className="text-ink-2">{w.source}</dt>
          <dd>{official ? <a href={official}>{t.councillor.officialPage}</a> : null}</dd>
        </dl>
      </PageHeader>

      <Section id="record" title={t.councillor.recordTitle} className="border-t border-rule">
        <p className="-mt-1 mb-4 max-w-[62ch] text-small text-ink-2">{t.councillor.recordLede}</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            [
              t.councillor.stats.attendance,
              own
                ? ownHeld
                  ? formatPercent(locale, ownAttended / ownHeld)
                  : "–"
                : p.attendance.expected && p.attendanceComparable
                  ? formatPercent(locale, p.attendance.attended / p.attendance.expected)
                  : "–",
            ],
            [t.councillor.stats.committees, committeesKnown ? formatNumber(locale, p.committees.length) : "–"],
            [t.councillor.stats.chairs, committeesKnown ? formatNumber(locale, p.committees.filter((x) => x.role === "chair").length) : "–"],
            [t.councillor.stats.declarations, formatNumber(locale, p.declarations.length)],
            [t.councillor.stats.questions, formatNumber(locale, p.mentions.filter((m) => m.kind === "question").length)],
            [t.councillor.stats.motions, formatNumber(locale, p.mentions.filter((m) => m.kind === "motion").length)],
          ].map(([label, value]) => (
            <div key={label} className="border-t border-rule pt-2">
              <dt className="text-small text-ink-2">{label}</dt>
              <dd className="font-serif text-h3 num">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="attendance" title={t.councillor.attendanceTitle} className="border-t border-rule">
        {own ? (
          <OfficialAttendance locale={locale} councilId={c.id} own={own} held={ownHeld} attended={ownAttended} source={p.sourceUrl} />
        ) : (
          <>
        <p className="-mt-1 mb-3 max-w-[62ch] text-small text-ink-2">
          {p.attendanceFrom ? t.councillor.attendanceLede.replace("{from}", formatDate(locale, p.attendanceFrom)) : null}
          {p.attendanceFrom && !p.attendanceFull ? ` ${t.councillor.attendanceShort.replace("{from}", formatDate(locale, p.attendanceFrom))}` : ""}
        </p>
        {!p.attendanceComparable ? <p className="mb-3 max-w-[62ch] text-small text-ink-2">{t.councillor.attendanceNotComparable}</p> : null}
        {p.attendance.expected ? (
          <p className="text-read">
            <Rich
              text={t.councillor.attendanceSentence}
              values={{
                attended: formatNumber(locale, p.attendance.attended),
                expected: formatNumber(locale, p.attendance.expected),
                share: formatPercent(locale, p.attendance.attended / p.attendance.expected),
              }}
            />
          </p>
        ) : (
          <p className="text-ink-2">{t.councillor.attendanceNone}</p>
        )}
        {p.attendanceRank && p.attendanceRank.of > 1 ? (
          <p className="mt-2 max-w-[62ch]">
            <Rich
              text={t.councillor.medianSentence}
              values={{ of: formatNumber(locale, p.attendanceRank.of), median: formatPercent(locale, p.attendanceRank.median) }}
            />
          </p>
        ) : null}
          </>
        )}
      </Section>

      <Section id="mentions" title={t.councillor.mentionsTitle} className="border-t border-rule">
        <p className="-mt-1 mb-3 max-w-[62ch] text-small text-ink-2">{t.councillor.mentionsLede}</p>
        {p.mentionsAmbiguous ? (
          <p className="text-ink-2">{t.councillor.mentionsAmbiguous}</p>
        ) : p.mentions.length ? (
          <ul className="rows max-w-[72ch]">
            {p.mentions.map((m, i) => {
              const committee = committeeName(locale, m.committeeEn, m.committeeCy);
              return (
                <li key={i} className="py-3">
                  <p className="text-meta text-ink-2">
                    {t.councillor.kinds[m.kind]}
                    {", "}
                    <span lang={committee.lang}>{committee.text}</span>
                    {", "}
                    <time dateTime={m.date}>{formatDate(locale, m.date)}</time>
                  </p>
                  <p>
                    <Link href={href(locale, `/${c.id}/meetings/${m.meetingId}`)} lang={locale === "cy" ? "en" : undefined}>
                      {m.detail ?? m.title}
                    </Link>
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-ink-2">{t.councillor.mentionsNone}</p>
        )}
      </Section>

      <Section id="committees" title={t.councillor.committeesTitle} className="border-t border-rule">
        {p.committees.length ? (
          <ul className="space-y-1">
            {p.committees.map((x) => {
              const name = committeeName(locale, x.nameEn, x.nameCy);
              return (
                <li key={x.id}>
                  <Link href={href(locale, `/${c.id}/committees/${x.id}`)} lang={name.lang}>
                    {name.text}
                  </Link>
                  {x.role !== "member" ? <span className="text-ink-2">, {roleLabel[x.role] ?? x.role}</span> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-ink-2">{committeesKnown ? t.councillor.committeesNone : t.councillor.committeesUnavailable}</p>
        )}
      </Section>

      <Section id="declarations" title={t.councillor.declarationsTitle} className="border-t border-rule">
        <p className="-mt-1 mb-3 max-w-[62ch] text-small text-ink-2">
          {t.councillor.declarationsScope}
          {p.declarationsCapped ? ` ${t.councillor.declarationsCapped}` : ""}
        </p>
        {p.declarations.length ? (
          <ul className="rows max-w-[72ch]">
            {p.declarations.map((d, i) => {
              const committee = committeeName(locale, d.committeeEn, d.committeeCy);
              const nature = pickText(locale, d.natureEn, d.natureCy);
              return (
                <li key={i} className="py-3">
                  <p>
                    <Link href={href(locale, `/${c.id}/meetings/${d.meetingId}#declarations`)} lang={committee.lang}>
                      {committee.text}
                    </Link>
                    {", "}
                    <time dateTime={d.date}>{formatDate(locale, d.date)}</time>
                  </p>
                  <p className="text-small">
                    {t.declarationKinds[d.kind as keyof typeof t.declarationKinds] ?? t.declarationKinds.other}
                    {d.item ? (
                      <>
                        {` ${t.meeting.declarationOn.split("{item}")[0]}`}
                        {/* Agenda titles are English only: mark them on Welsh pages. */}
                        <span lang={locale === "cy" ? "en" : undefined}>{d.item}</span>
                        {t.meeting.declarationOn.split("{item}")[1]}
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
        ) : (
          <p className="text-ink-2">{t.councillor.declarationsNone}</p>
        )}
      </Section>
    </>
  );
}

function OfficialAttendance({
  locale,
  councilId,
  own,
  held,
  attended,
  source,
}: {
  locale: Locale;
  councilId: string;
  own: NonNullable<CouncillorDetail["officialAttendance"]>;
  held: number;
  attended: number;
  source: string | null;
}) {
  const t = councilMessages[locale].councillor;
  const cell = (n: number | null) => (n === null ? <span className="text-ink-3">–</span> : formatNumber(locale, n));
  return (
    <>
      <p className="-mt-1 mb-3 max-w-[62ch] text-small text-ink-2">
        {own.period ? t.officialLede.replace("{period}", own.period) : t.officialLedeNoPeriod}{" "}
        {source ? <a href={source}>{t.officialPage}</a> : null}
      </p>
      {held ? (
        <p className="text-read">
          <Rich
            text={t.attendanceSentence}
            values={{ attended: formatNumber(locale, attended), expected: formatNumber(locale, held), share: formatPercent(locale, attended / held) }}
          />
        </p>
      ) : (
        <p className="text-ink-2">{t.officialNone}</p>
      )}
      {own.rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="data-table max-w-[44rem]">
            <thead>
              <tr>
                <th scope="col">{t.officialCols.body}</th>
                <th scope="col" className="text-right">
                  {t.officialCols.held}
                </th>
                <th scope="col" className="text-right">
                  {t.officialCols.attended}
                </th>
                <th scope="col" className="text-right">
                  {t.officialCols.apologies}
                </th>
              </tr>
            </thead>
            <tbody>
              {own.rows.map((r) => (
                <tr key={r.name}>
                  <th scope="row" className="text-left font-medium" lang={locale === "cy" ? "en" : undefined}>
                    {r.committeeId ? <Link href={href(locale, `/${councilId}/committees/${r.committeeId}`)}>{r.name}</Link> : r.name}
                  </th>
                  <td className="text-right num">{cell(r.held)}</td>
                  <td className="text-right num">{cell(r.attended)}</td>
                  <td className="text-right num">{cell(r.apologies)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="mt-3 max-w-[62ch] text-small text-ink-2">{t.officialNote}</p>
    </>
  );
}
