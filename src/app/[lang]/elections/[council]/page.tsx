import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Section } from "@/components/page-header";
import { partsFrom, partsFrom2022, recordsParties, rowsFor, SeatsBar } from "@/components/seats";
import { BlockSkeleton } from "@/components/skeleton";
import { byElections, results2022, seatsNow, wardsWithCouncillors } from "@/data/elections";
import { CouncilResults2022 } from "@/components/results-2022";
import { ByElectionsTable } from "@/components/by-elections";
import { BOUNDARY_CHANGES, COUNCIL_ELECTIONS, electionFor } from "@data/curated/elections";
import { href, type Locale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { electionMessages } from "@/i18n/messages/elections";
import { pickText } from "@/i18n/pick";
import { getLocale } from "@/i18n/server";
import { councilConfig, councilName, liveCouncil } from "@/lib/councils";
import { controlText } from "@/lib/elections";
import { pageMetadata } from "@/lib/metadata";
import { partyColour, partyName } from "@/lib/parties";

type Params = Promise<{ council: string }>;

export function generateStaticParams() {
  return COUNCIL_ELECTIONS.map((e) => ({ council: e.id }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/elections/[council]">): Promise<Metadata> {
  const locale = await getLocale();
  const { council } = await params;
  const c = councilConfig(council);
  if (!c || !electionFor(council)) return { title: common[locale].notFound.title };
  const t = electionMessages[locale];
  const name = councilName(locale, c);
  return pageMetadata({
    locale,
    path: `/elections/${c.id}`,
    title: t.councilTitle.replace("{name}", name),
    description: t.councilLede.replace("{name}", name),
  });
}

export default async function CouncilElectionPage({ params }: PageProps<"/[lang]/elections/[council]">) {
  const locale = await getLocale();
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={10} label={common[locale].words.loading} />}>
        <CouncilElection locale={locale} params={params} />
      </Suspense>
    </div>
  );
}

async function CouncilElection({ locale, params }: { locale: Locale; params: Params }) {
  const { council } = await params;
  const c = councilConfig(council);
  const e = electionFor(council);
  if (!c || !e) notFound();
  const t = electionMessages[locale];
  const name = councilName(locale, c);
  const live = Boolean(liveCouncil(c.id));
  const [all, wards, by, r22] = await Promise.all([seatsNow(), live ? wardsWithCouncillors(c.id) : Promise.resolve([]), byElections(), results2022()]);
  const mine2022 = r22?.councils.find((x) => x.councilId === c.id);
  const byHere = by?.rows.filter((r) => r.councilId === c.id) ?? [];
  const here = rowsFor(all, c.id);
  const now = recordsParties(here) ? partsFrom(locale, here, t.otherGroups) : [];
  const then = partsFrom2022(locale, e.election2022.seats, t.otherGroups);
  const boundary = BOUNDARY_CHANGES.find((b) => b.id === c.id);
  const note = locale === "cy" ? e.noteCy : e.noteEn;
  const sum = (parts: { seats: number }[]) => parts.reduce((n, p) => n + p.seats, 0);

  return (
    <>
      <p className="mb-2 text-small">
        <Link href={href(locale, "/elections")}>{t.allCouncils}</Link>
      </p>
      <PageHeader title={t.councilTitle.replace("{name}", name)} lede={t.councilLede.replace("{name}", name)} />

      <Section id="control" title={t.councilTitleOne} className="border-t border-rule">
        <dl className="grid max-w-[44rem] gap-x-8 gap-y-3 sm:grid-cols-[12rem_1fr]">
          <dt className="font-semibold">{t.col.control}</dt>
          <dd>{controlText(locale, e)}</dd>
          <dt className="font-semibold">{t.col.leader}</dt>
          <dd>
            {e.leader.name}, {e.leader.party === "ind" ? t.independent : partyName(locale, e.leader.party, null)}
          </dd>
        </dl>
        {note ? <p className="mt-4 max-w-[62ch]">{note}</p> : null}
        {boundary ? (
          <p className="mt-4 max-w-[62ch]">
            {t.newWards.replace("{seats}", boundary.seats ? t.newWardsSeats.replace("{n}", formatNumber(locale, boundary.seats)) : "")}
          </p>
        ) : null}
        {e.controlSources[0] ? (
          <p className="mt-3 text-meta text-ink-2">
            <a href={e.controlSources[0]} rel="noopener">
              {t.controlSource}
            </a>
          </p>
        ) : null}
      </Section>

      <Section id="seats" title={t.compareTitle} className="border-t border-rule">
        <div className="grid max-w-[56rem] gap-8">
          {now.length ? (
            <div>
              <h3 className="mb-2 font-sans text-small font-semibold">
                {t.nowLabel}, {t.seats.replace("{n}", formatNumber(locale, sum(now)))}
              </h3>
              <SeatsBar locale={locale} parts={now} label={t.nowLabel} />
            </div>
          ) : null}
          <div>
            <h3 className="mb-2 font-sans text-small font-semibold">
              {t.then2022}, {t.seats.replace("{n}", formatNumber(locale, sum(then)))}
            </h3>
            <SeatsBar locale={locale} parts={then} label={t.then2022} />
            <p className="mt-2 text-meta text-ink-2">
              <a href={e.election2022.source} rel="noopener">
                {t.controlSource}
              </a>
            </p>
          </div>
        </div>
      </Section>

      {mine2022 ? <CouncilResults2022 locale={locale} r={mine2022} /> : null}

      <Section id="by-elections" title={t.byTitle} className="border-t border-rule">
        {byHere.length ? (
          <>
            <ByElectionsTable locale={locale} rows={byHere} withCouncil={false} />
            <p className="mt-3 max-w-[62ch] text-meta text-ink-2">{t.byCouncilNote}</p>
          </>
        ) : (
          <p className="max-w-[62ch] text-ink-2">{by ? t.byNone : t.byNotLoaded}</p>
        )}
      </Section>

      {wards.length ? (
        <Section id="wards" title={t.wardsTitle} className="border-t border-rule">
          <p className="-mt-1 mb-4 max-w-[62ch] text-ink-2">{t.wardsLede}</p>
          <ul className="rows">
            {wards.map((w) => (
              <li key={w.slug} className="grid gap-1 py-3 sm:grid-cols-[16rem_1fr]">
                <Link href={href(locale, `/${c.id}/wards/${w.slug}`)} className="font-semibold" lang={pickText(locale, w.nameEn, w.nameCy).lang}>
                  {pickText(locale, w.nameEn, w.nameCy).text}
                </Link>
                <ul className="flex flex-wrap gap-x-5 gap-y-1">
                  {w.councillors.map((p) => (
                    <li key={p.id} className="inline-flex items-center gap-2">
                      <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: partyColour(p.partyId, p.partyLabel) }} />
                      <Link href={href(locale, `/${c.id}/councillors/${p.id}`)}>{p.name}</Link>
                      <span className="text-meta text-ink-2">{partyName(locale, p.partyId, p.partyLabel)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
