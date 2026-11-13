import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, Section } from "@/components/page-header";
import { PostcodeForm } from "@/components/postcode-form";
import { partsFrom, partsFrom2022, recordsParties, rowsFor, SeatsBar, type SeatPart } from "@/components/seats";
import { ShareChart, type ShareRow } from "@/components/share-chart";
import { BlockSkeleton } from "@/components/skeleton";
import { byElections, daysToElection, results2022, seatsNow } from "@/data/elections";
import { WalesResults2022 } from "@/components/results-2022";
import { ByElectionsTable, changedHands } from "@/components/by-elections";
import {
  BOUNDARY_CHANGES,
  BY_ELECTIONS,
  COUNCIL_ELECTIONS,
  ELECTIONS_AS_OF,
  SENEDD_2026,
  SENEDD_POLLS,
} from "@data/curated/elections";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatList, formatNumber, formatPercent } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { electionMessages } from "@/i18n/messages/elections";
import { Rich } from "@/i18n/rich";
import { getLocale } from "@/i18n/server";
import { councilConfig, councilShort } from "@/lib/councils";
import { controlText } from "@/lib/elections";
import { pageMetadata } from "@/lib/metadata";
import { partyColour, partyName } from "@/lib/parties";

/*
 * The 2027 council elections: what's happening, who holds the seats now and
 * who runs each council, what polls there are, and a way to your own ward.
 */

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = electionMessages[locale];
  return pageMetadata({ locale, path: "/elections", title: t.title, description: t.lede });
}

export default async function ElectionsPage() {
  const locale = await getLocale();
  const t = electionMessages[locale];
  const loading = common[locale].words.loading;
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede}>
        <Suspense fallback={null}>
          <Countdown locale={locale} />
        </Suspense>
        <p className="mt-3 text-small">
          <a href="#parties">{t.jumpParties}</a>
        </p>
      </PageHeader>

      <Section id="ward" title={t.wardTitle} className="border-t border-rule">
        <p className="-mt-1 mb-4 max-w-[62ch]">{t.ward}</p>
        <PostcodeForm locale={locale} label={t.postcodeLabel} />
      </Section>

      <Section id="what" title={t.whatTitle} className="border-t border-rule">
        <ul className="max-w-[62ch] list-disc space-y-2 pl-5">
          {t.facts.map((f, i) => (
            <li key={i}>
              <Rich text={f} />
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-h4">{t.registerTitle}</h3>
        <p className="mt-2 max-w-[62ch]">
          <Rich text={t.register} links={{ reg: locale === "cy" ? "https://www.gov.uk/register-to-vote?lang=cy" : "https://www.gov.uk/register-to-vote" }} />
        </p>
      </Section>

      <Suspense fallback={<BlockSkeleton lines={12} label={loading} />}>
        <StateOfPlay locale={locale} />
      </Suspense>

      <Section id="polls" title={t.pollsTitle} className="border-t border-rule">
        <p className="max-w-[62ch]">{t.pollsNone}</p>
        <p className="mt-2 max-w-[62ch] text-ink-2">{t.pollsSenedd}</p>
        <div className="mt-6 grid max-w-[48rem] gap-12">
          <div>
            <h3 className="text-h4">{t.seneddResultTitle}</h3>
            <p className="mt-1 text-small text-ink-2">{t.seneddResultNote.replace("{turnout}", formatPercent(locale, SENEDD_2026.turnout / 100, 1))}</p>
            <table className="data-table mt-3">
              <thead>
                <tr>
                  <th scope="col">{t.party}</th>
                  <th scope="col" className="text-right">
                    {t.share}
                  </th>
                  <th scope="col" className="text-right">
                    {t.seatsCol}
                  </th>
                </tr>
              </thead>
              <tbody>
                {SENEDD_2026.results.map((r) => (
                  <tr key={r.party}>
                    <td>
                      <PartyDot id={r.party} locale={locale} other={t.otherGroups} />
                    </td>
                    <td className="text-right num">{formatPercent(locale, r.share / 100, 1)}</td>
                    <td className="text-right num">{formatNumber(locale, r.seats)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-meta text-ink-2">
              <a href={SENEDD_2026.sources[2] ?? SENEDD_2026.sources[0]} rel="noopener">
                {t.controlSource}
              </a>
            </p>
          </div>
          <div className="overflow-x-auto">
            <h3 className="text-h4">{t.seneddPollsTitle}</h3>
            <table className="data-table mt-3">
              <thead>
                <tr>
                  <th scope="col" className="min-w-[11rem]">{t.pollCol.pollster}</th>
                  {["pc", "reform", "lab", "con", "green", "ld"].map((p) => (
                    <th key={p} scope="col" className="text-right">
                      {partyName(locale, p, null)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SENEDD_POLLS.map((p) => (
                  <tr key={`${p.pollster}-${p.date}`}>
                    <td>
                      <a href={p.source} rel="noopener">
                        {p.pollster}
                      </a>
                      <span className="block text-meta text-ink-2">
                        {(p.fieldwork ? t.pollDate : t.pollPublished).replace("{date}", formatDate(locale, p.date, "short"))}
                      </span>
                    </td>
                    {["pc", "reform", "lab", "con", "green", "ld"].map((k) => (
                      <td key={k} className="text-right num">
                        {(p.shares as Record<string, number>)[k] !== undefined ? `${(p.shares as Record<string, number>)[k]}%` : "–"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Suspense fallback={<BlockSkeleton lines={8} label={common[locale].words.loading} />}>
        <Closest2022 locale={locale} />
      </Suspense>

      <Section id="by-elections" title={t.byTitle} className="border-t border-rule">
        <Suspense fallback={<BlockSkeleton lines={6} label={common[locale].words.loading} />}>
          <ByElections locale={locale} />
        </Suspense>
      </Section>

      <Section id="sources" title={t.sourcesTitle} className="border-t border-rule">
        <p className="max-w-[62ch] text-small text-ink-2">{t.sources.replace("{date}", formatDate(locale, ELECTIONS_AS_OF))}</p>
      </Section>
    </div>
  );
}

/** Each party's shares, in percent, for the comparison chart. Independents and local groups count with "others", as in the seat bars. */
function compareRows(locale: Locale, now: SeatPart[], then: SeatPart[]): ShareRow[] {
  const t = electionMessages[locale];
  const total = (parts: SeatPart[]) => parts.reduce((n, p) => n + p.seats, 0);
  const share = (parts: SeatPart[], key: string) => {
    const n = total(parts);
    const p = parts.find((x) => x.key === key);
    return n ? ((p?.seats ?? 0) / n) * 100 : null;
  };
  const senedd = (key: string) => SENEDD_2026.results.find((r) => r.party === key)?.share ?? null;
  const polls = (key: string) => {
    const v = SENEDD_POLLS.map((p) => (p.shares as Record<string, number>)[key]).filter((x) => x !== undefined);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  return ["pc", "reform", "lab", "con", "green", "ld", "other"].map((key) => ({
    key,
    label: key === "other" ? t.compareOther : partyName(locale, key, null),
    colour: partyColour(key === "other" ? null : key),
    seats2022: share(then, key),
    seatsNow: share(now, key),
    senedd: senedd(key),
    polls: polls(key),
  }));
}

function PartyDot({ id, locale, other }: { id: string; locale: Locale; other: string }) {
  const known = ["lab", "con", "pc", "ld", "green", "reform", "ind"].includes(id);
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: partyColour(known ? id : null) }} />
      {known ? partyName(locale, id, null) : other}
    </span>
  );
}

async function Countdown({ locale }: { locale: Locale }) {
  const t = electionMessages[locale];
  const n = await daysToElection();
  if (n < 0) return null;
  return (
    <p className="mt-4 text-read">
      <Rich text={n === 0 ? t.countdownToday : t.countdown.replace("{n}", formatNumber(locale, n))} />
    </p>
  );
}

async function StateOfPlay({ locale }: { locale: Locale }) {
  const t = electionMessages[locale];
  const all = await seatsNow();
  // Compare like with like: only councils whose full list of councillors we hold.
  const held = new Set(
    COUNCIL_ELECTIONS.filter((e) => {
      const rows = rowsFor(all, e.id);
      const seats = rows.reduce((n, r) => n + r.seats, 0);
      const expected = BOUNDARY_CHANGES.find((b) => b.id === e.id)?.seats ?? e.election2022.total;
      // Allow for a vacant seat or two: an empty seat is not a missing councillor.
      // A list that records no parties at all (Wrexham's) can't be split by party.
      return recordsParties(rows) && seats >= Math.min(e.election2022.total, expected) - 2;
    }).map((e) => e.id),
  );
  const now = partsFrom(locale, all.filter((r) => held.has(r.councilId)), t.otherGroups);
  const totals2022: Record<string, number> = {};
  for (const c of COUNCIL_ELECTIONS)
    if (held.has(c.id)) for (const [k, v] of Object.entries(c.election2022.seats)) totals2022[k] = (totals2022[k] ?? 0) + v;
  const then = partsFrom2022(locale, totals2022, t.otherGroups);
  const councils = [...COUNCIL_ELECTIONS].sort((a, b) => {
    const ca = councilConfig(a.id);
    const cb = councilConfig(b.id);
    return (ca ? councilShort(locale, ca) : a.id).localeCompare(cb ? councilShort(locale, cb) : b.id, locale);
  });
  const sum = (parts: { seats: number }[]) => parts.reduce((n, p) => n + p.seats, 0);
  return (
    <>
      <Section id="state-of-play" title={t.playTitle} className="border-t border-rule">
        <p className="-mt-1 mb-2 max-w-[62ch] text-ink-2">{t.playLede}</p>
        {held.size < COUNCIL_ELECTIONS.length ? (
          <p className="mb-6 max-w-[62ch] text-small text-ink-2">
            {t.playScope.replace("{n}", formatNumber(locale, held.size)).replace("{total}", formatNumber(locale, COUNCIL_ELECTIONS.length))}
          </p>
        ) : (
          <div className="mb-6" />
        )}
        <div className={held.size ? "grid max-w-[56rem] gap-8" : "hidden"}>
          <div>
            <h3 className="mb-2 font-sans text-small font-semibold">
              {t.nowLabel}, {t.seats.replace("{n}", formatNumber(locale, sum(now)))}
            </h3>
            <SeatsBar locale={locale} parts={now} label={t.nowLabel} />
          </div>
          <div>
            <h3 className="mb-2 font-sans text-small font-semibold">
              {t.then2022}, {t.seats.replace("{n}", formatNumber(locale, sum(then)))}
            </h3>
            <SeatsBar locale={locale} parts={then} label={t.then2022} />
          </div>
        </div>
      </Section>
      <Section id="parties" title={t.voteCompareTitle} className="border-t border-rule">
        <p className="-mt-1 mb-4 max-w-[62ch] text-ink-2">{t.compareLede}</p>
        {held.size ? <ShareChart locale={locale} rows={compareRows(locale, now, then)} labels={t.compareLabels} /> : null}
        <p className="mt-4 max-w-[62ch] text-small text-ink-2">
          {t.comparePolls.replace("{n}", formatNumber(locale, SENEDD_POLLS.length)).replace("{list}", formatList(locale, SENEDD_POLLS.map((p) => p.pollster)))}
        </p>
        <p className="mt-2 max-w-[62ch] text-small text-ink-2">{t.compareNote}</p>
      </Section>
      <Section id="councils" title={t.councilsTitle} className="border-t border-rule">
        <p className="-mt-1 mb-4 max-w-[62ch] text-ink-2">{t.councilsLede}</p>
        {/* Stacks on phones (data-table-stack), where four columns with a seats bar would not fit. */}
        <div className="overflow-x-auto">
          <table className="data-table data-table-stack">
            <thead>
              <tr>
                <th scope="col">{t.col.council}</th>
                <th scope="col">{t.col.control}</th>
                <th scope="col">{t.col.leader}</th>
                <th scope="col" className="min-w-[14rem]">
                  {t.col.seatsNow}
                </th>
              </tr>
            </thead>
            <tbody>
              {councils.map((e) => {
                const c = councilConfig(e.id);
                const rows = rowsFor(all, e.id);
                const parts = recordsParties(rows) ? partsFrom(locale, rows, t.otherGroups) : [];
                const note = locale === "cy" ? e.noteCy : e.noteEn;
                return (
                  <tr key={e.id}>
                    <th scope="row" className="font-semibold sm:font-normal">
                      <Link href={href(locale, `/elections/${e.id}`)}>{c ? councilShort(locale, c) : e.id}</Link>
                    </th>
                    <td data-label={t.col.control}>
                      {controlText(locale, e)}
                      {note ? <span className="block max-w-[28ch] text-meta text-ink-2">{note}</span> : null}
                    </td>
                    <td data-label={t.col.leader}>
                      {e.leader.name}
                      <span className="block text-meta text-ink-2">{e.leader.party === "ind" ? t.independent : partyName(locale, e.leader.party, null)}</span>
                    </td>
                    <td data-label={t.col.seatsNow}>
                      {held.has(e.id) ? (
                        <SeatsBar locale={locale} parts={parts} label={c ? councilShort(locale, c) : e.id} compact />
                      ) : (
                        <>
                          <p className="mb-1 text-meta text-ink-2">{t.noSeatsNow}</p>
                          <SeatsBar locale={locale} parts={partsFrom2022(locale, e.election2022.seats, t.otherGroups)} label={t.then2022} compact />
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

async function ByElections({ locale }: { locale: Locale }) {
  const t = electionMessages[locale];
  const data = await byElections();
  const note = (
    <p className="mt-3 max-w-[62ch] text-meta text-ink-2">
      {t.byNote}{" "}
      {BY_ELECTIONS.sources.map((u, i) => (
        <span key={u}>
          {i ? ", " : ""}
          <a href={u} rel="noopener">
            {u.slice(-4)}
          </a>
        </span>
      ))}
    </p>
  );
  if (!data?.rows.length)
    return (
      <>
        <p className="max-w-[62ch]">{t.by.replace("{count}", formatNumber(locale, BY_ELECTIONS.approxCount))}</p>
        {note}
      </>
    );
  const changed = data.rows.filter(changedHands).length;
  return (
    <>
      <p className="mb-4 max-w-[62ch]">
        {t.byListed
          .replace("{n}", formatNumber(locale, data.rows.length))
          .replace("{changed}", formatNumber(locale, changed))}
      </p>
      <ByElectionsTable locale={locale} rows={data.rows} withCouncil />
      {note}
    </>
  );
}

async function Closest2022({ locale }: { locale: Locale }) {
  const r = await results2022();
  return r ? <WalesResults2022 locale={locale} all={r.councils} /> : null;
}
