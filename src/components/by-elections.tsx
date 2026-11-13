import Link from "next/link";
import type { ByElectionRow } from "@/data/elections";
import { href, type Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { electionMessages } from "@/i18n/messages/elections";
import { councilConfig, councilShort } from "@/lib/councils";
import { partyColour, partyName } from "@/lib/parties";

/** Whether the seat went to a different party or group: the archive's labels differ. */
export const changedHands = (r: ByElectionRow) => r.from.trim().toLowerCase() !== r.to.trim().toLowerCase();

function Party({ locale, id, label }: { locale: Locale; id: string | null; label: string }) {
  const t = electionMessages[locale];
  const text = /independent\s*\/\s*other/i.test(label) ? t.byIndependentOther : partyName(locale, id, label);
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: partyColour(id) }} />
      {text}
    </span>
  );
}

/** By-elections in a table, newest first. Shows the first `show` and puts the rest behind a "show all". */
export function ByElectionsTable({ locale, rows, withCouncil, show = 12 }: { locale: Locale; rows: ByElectionRow[]; withCouncil: boolean; show?: number }) {
  const t = electionMessages[locale];
  const body = (list: ByElectionRow[]) =>
    list.map((r) => {
      const c = councilConfig(r.councilId);
      return (
        <tr key={`${r.date}-${r.councilId}-${r.ward}`}>
          <td className="whitespace-nowrap num">{formatDate(locale, r.date, "short")}</td>
          {withCouncil ? <td>{c ? <Link href={href(locale, `/elections/${c.id}`)}>{councilShort(locale, c)}</Link> : r.councilId}</td> : null}
          <td lang={locale === "cy" ? "en" : undefined}>{r.ward}</td>
          <td>
            <Party locale={locale} id={r.fromParty} label={r.from} />
          </td>
          <td>
            <Party locale={locale} id={r.toParty} label={r.to} />
          </td>
          <td>{changedHands(r) ? t.byChanged : t.byKept}</td>
        </tr>
      );
    });
  const head = (
    <thead>
      <tr>
        <th scope="col">{t.byCols.date}</th>
        {withCouncil ? <th scope="col">{t.byCols.council}</th> : null}
        <th scope="col">{t.byCols.ward}</th>
        <th scope="col">{t.byCols.before}</th>
        <th scope="col">{t.byCols.after}</th>
        <th scope="col">{t.byCols.result}</th>
      </tr>
    </thead>
  );
  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[44rem]">
        {head}
        <tbody>{body(rows.slice(0, show))}</tbody>
      </table>
      {rows.length > show ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-small">{t.byShowAll.replace("{n}", String(rows.length))}</summary>
          <table className="data-table mt-2 min-w-[44rem]">
            {head}
            <tbody>{body(rows.slice(show))}</tbody>
          </table>
        </details>
      ) : null}
    </div>
  );
}
