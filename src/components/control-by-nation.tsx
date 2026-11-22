import { SeatsBar, type SeatPart } from "@/components/seats";
import { controlOf, listCompositions } from "@/data/outside";
import type { Locale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import { ukMessages } from "@/i18n/messages/uk";
import { partyColour, partyName } from "@/lib/parties";
import { councilsIn, NATIONS } from "@/lib/register";

const ORDER = ["lab", "con", "ld", "reform", "green", "snp", "pc", "other", "unclear"];

/**
 * Councils in each nation by the party with the most seats, from Open Council Data UK. Northern Ireland is left out:
 * its councils share power between parties, so "most seats" says little about who runs them.
 */
export async function ControlByNation({ locale }: { locale: Locale }) {
  const t = ukMessages[locale].outside;
  const all = await listCompositions();
  if (!all.length) return null;
  const byId = new Map(all.map((c) => [c.councilId, c]));
  const year = Math.max(...all.map((c) => c.year));
  const nations = NATIONS.filter((n) => n !== "Northern Ireland");
  return (
    <ul className="space-y-6">
      {nations.map((n) => {
        const councils = councilsIn(n).filter((c) => byId.has(c.id));
        const counts = new Map<string, { n: number; majority: number }>();
        for (const c of councils) {
          const lead = controlOf(byId.get(c.id)!.control);
          const key = lead ? (ORDER.includes(lead.partyId) ? lead.partyId : "other") : "unclear";
          const x = counts.get(key) ?? { n: 0, majority: 0 };
          x.n++;
          if (lead?.majority) x.majority++;
          counts.set(key, x);
        }
        const parts: SeatPart[] = [...counts]
          .sort((a, b) => b[1].n - a[1].n || ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))
          .map(([key, x]) => ({
            key,
            label: key === "other" ? t.otherGroups : key === "unclear" ? t.unclear : partyName(locale, key, null),
            seats: x.n,
            colour: key === "other" || key === "unclear" ? partyColour(null) : partyColour(key),
          }));
        return (
          <li key={n}>
            <h3 className="mb-2 font-sans text-body font-semibold">{t.controlNation.replace("{nation}", n).replace("{n}", formatNumber(locale, councils.length))}</h3>
            <SeatsBar locale={locale} parts={parts} label={t.controlNation.replace("{nation}", n).replace("{n}", String(councils.length))} compact />
          </li>
        );
      })}
      <li className="text-meta text-ink-2">
        {t.controlSource.replace("{year}", String(year))}{" "}
        <a href="https://opencouncildata.co.uk" rel="noopener">
          opencouncildata.co.uk
        </a>
      </li>
    </ul>
  );
}
