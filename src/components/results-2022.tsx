import Link from "next/link";
import { Section } from "@/components/page-header";
import type { Council2022 } from "@/data/elections";
import { href, type Locale } from "@/i18n/config";
import { formatList, formatNumber } from "@/i18n/format";
import { electionMessages } from "@/i18n/messages/elections";
import { COUNCILS, councilShort } from "@/lib/councils";
import { partyColour, partyName } from "@/lib/parties";
import type { Candidate, Margin } from "../../pipeline/sources/election-results";

/*
 * The May 2022 results ward by ward (pipeline/jobs/election-results.ts):
 * the closest wards by the published votes, and the councillors now
 * sitting for a different party. A statement of the 2022 arithmetic only.
 */

function votesText(locale: Locale, n: number) {
  const t = electionMessages[locale].r22;
  return n === 1 ? t.vote : t.votes.replace("{n}", formatNumber(locale, n));
}

function Who({ locale, c }: { locale: Locale; c: Candidate }) {
  const t = electionMessages[locale].r22;
  return (
    <>
      <span className="block">{c.name}</span>
      <span className="inline-flex items-center gap-1.5 text-meta text-ink-2">
        <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: partyColour(c.partyId, c.partyLabel || null) }} />
        {c.partyLabel ? partyName(locale, c.partyId, c.partyLabel) : t.noParty}
      </span>
    </>
  );
}

function MarginTable({ locale, rows, council, base }: { locale: Locale; rows: Margin[]; council?: (m: Margin) => string; base: (m: Margin) => string | null }) {
  const t = electionMessages[locale].r22;
  return (
    <div className="overflow-x-auto">
      <table className="data-table data-table-stack">
        <thead>
          <tr>
            <th scope="col">{t.cols.ward}</th>
            <th scope="col">{t.cols.lastElected}</th>
            <th scope="col">{t.cols.firstNot}</th>
            <th scope="col" className="sm:text-right">
              {t.cols.gap}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={`${council ? council(m) : ""}${m.ward}`}>
              <th scope="row" className="font-semibold sm:font-normal">
                {base(m) && m.lastElected.areaId ? (
                  <a href={`${base(m)}/mgElectionAreaResults.aspx?ID=${m.lastElected.areaId}`} rel="noopener">
                    {m.ward}
                  </a>
                ) : (
                  m.ward
                )}
                {council ? <span className="block text-meta font-normal text-ink-2">{council(m)}</span> : null}
              </th>
              <td data-label={t.cols.lastElected}>
                <Who locale={locale} c={m.lastElected} />
              </td>
              <td data-label={t.cols.firstNot}>
                <Who locale={locale} c={m.firstNotElected} />
              </td>
              <td data-label={t.cols.gap} className="num sm:text-right">
                {votesText(locale, m.votes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sourceLink(locale: Locale, r: Council2022, base: string | null) {
  const t = electionMessages[locale].r22;
  const url = r.page ?? base;
  if (!url) return null;
  return (
    <p className="mt-3 text-meta text-ink-2">
      <a href={url} rel="noopener">
        {r.page ? t.source : t.sourceService}
      </a>
    </p>
  );
}

/** A council's 2022 results: the closest wards, then the councillors now sitting for a different party. */
export function CouncilResults2022({ locale, r }: { locale: Locale; r: Council2022 }) {
  const t = electionMessages[locale].r22;
  const c = COUNCILS.find((x) => x.id === r.councilId);
  if (!r.covered)
    return (
      <Section id="results-2022" title={t.title} className="border-t border-rule">
        <p className="max-w-[62ch] text-ink-2">{t.notCovered}</p>
      </Section>
    );
  const closest = r.margins[0];
  return (
    <>
      <Section id="results-2022" title={t.title} className="border-t border-rule">
        <p className="-mt-1 mb-3 max-w-[62ch] text-ink-2">{t.lede}</p>
        {closest ? (
          <p className="mb-5 max-w-[62ch] text-read">
            {(closest.votes === 0 ? t.leadTie : t.lead)
              .replace("{contested}", formatNumber(locale, r.contested))
              .replace("{wards}", formatNumber(locale, r.wards))
              .replace("{ward}", closest.ward)
              .replace("{votes}", votesText(locale, closest.votes))}
          </p>
        ) : null}
        <MarginTable locale={locale} rows={r.margins.slice(0, 5)} base={() => c?.moderngovBase ?? null} />
        {r.margins.length > 5 ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-small">{t.showAll.replace("{n}", formatNumber(locale, r.margins.length))}</summary>
            <div className="mt-3">
              <MarginTable locale={locale} rows={r.margins.slice(5)} base={() => c?.moderngovBase ?? null} />
            </div>
          </details>
        ) : null}
        {sourceLink(locale, r, c?.moderngovBase ?? null)}
      </Section>
      <Section id="changed-party" title={t.changesTitle} className="border-t border-rule">
        <p className="-mt-1 mb-3 max-w-[62ch] text-small text-ink-2">{t.changesLede}</p>
        {r.changes.length ? (
          <ul className="rows max-w-[48rem]">
            {r.changes.map((x) => (
              <li key={x.councillorId} className="py-2.5">
                <Link href={href(locale, `/${r.councilId}/councillors/${x.councillorId}`)} className="font-semibold">
                  {x.name}
                </Link>
                <p className="text-small text-ink-2">
                  {t.changeLine
                    .replace("{then}", partyName(locale, x.party2022.id, x.party2022.label))
                    .replace("{ward}", x.ward2022)
                    .replace("{now}", partyName(locale, x.partyNow.id, x.partyNow.label))}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="max-w-[62ch]">{t.changesNone}</p>
        )}
      </Section>
    </>
  );
}

/** Across Wales: the ten closest wards in the councils whose results pass the checks. */
export function WalesResults2022({ locale, all }: { locale: Locale; all: Council2022[] }) {
  const t = electionMessages[locale].r22;
  const covered = all.filter((r) => r.covered);
  if (!covered.length) return null;
  const name = (id: string) => {
    const c = COUNCILS.find((x) => x.id === id);
    return c ? councilShort(locale, c) : id;
  };
  const owner = new Map<Margin, string>();
  for (const r of covered) for (const m of r.margins) owner.set(m, r.councilId);
  const top = [...owner.keys()].sort((a, b) => a.votes - b.votes || a.ward.localeCompare(b.ward)).slice(0, 10);
  const changes = covered.reduce((n, r) => n + r.changes.length, 0);
  const collation = locale === "cy" ? "cy" : "en";
  const list = formatList(locale, covered.map((r) => name(r.councilId)).sort((a, b) => a.localeCompare(b, collation)), { places: true });
  return (
    <Section id="closest-2022" title={t.walesTitle} className="border-t border-rule">
      <p className="-mt-1 mb-4 max-w-[62ch] text-ink-2">{t.walesLede}</p>
      <MarginTable
        locale={locale}
        rows={top}
        council={(m) => name(owner.get(m) ?? "")}
        base={(m) => COUNCILS.find((x) => x.id === owner.get(m))?.moderngovBase ?? null}
      />
      <p className="mt-4 max-w-[62ch] text-small text-ink-2">
        {t.walesCovered.replace("{n}", formatNumber(locale, covered.length)).replace("{list}", list)}
      </p>
      <p className="mt-2 max-w-[62ch] text-small text-ink-2">
        {changes === 1 ? t.walesChangesOne : t.walesChanges.replace("{n}", formatNumber(locale, changes))}
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-small">
        {covered.map((r) => (
          <li key={r.councilId}>
            <Link href={href(locale, `/elections/${r.councilId}#results-2022`)}>{name(r.councilId)}</Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
