import { Section } from "@/components/page-header";
import { partsFrom, SeatsBar } from "@/components/seats";
import { leadOf, getClimate, getComposition, getWdtkUrl } from "@/data/outside";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { ukMessages } from "@/i18n/messages/uk";
import { partyName } from "@/lib/parties";

/** Party balance and control from Open Council Data UK, for councils whose own records we don't read. */
export async function PartyBalance({ locale, councilId, name }: { locale: Locale; councilId: string; name: string }) {
  const t = ukMessages[locale].outside;
  const c = await getComposition(councilId);
  if (!c || !c.seats) return null;
  const parts = partsFrom(locale, c.parties, t.otherGroups);
  const lead = leadOf(c);
  const leadName = lead ? (lead.partyId === "other" ? t.otherGroups : partyName(locale, lead.partyId, null)) : null;
  return (
    <Section title={t.balanceTitle} icon="councillors">
      {leadName && <p className="mb-4 max-w-[62ch]">{(lead!.majority ? t.majority : t.largest).replace("{party}", leadName)}</p>}
      <div className="max-w-[40rem]">
        <SeatsBar locale={locale} parts={parts} label={t.balanceLabel.replace("{council}", name).replace("{n}", String(c.seats))} />
      </div>
      <p className="mt-3 max-w-[62ch] text-meta text-ink-2">
        {t.balanceSource.replace("{year}", String(c.year))}{" "}
        <a href="https://opencouncildata.co.uk" rel="noopener">
          opencouncildata.co.uk
        </a>
      </p>
    </Section>
  );
}

/** Climate plans (mySociety's CAPE) and freedom of information (WhatDoTheyKnow), for any council. */
export async function ClimateAndFoi({ locale, councilId, name }: { locale: Locale; councilId: string; name: string }) {
  const t = ukMessages[locale].outside;
  const [climate, wdtk] = await Promise.all([getClimate(councilId), getWdtkUrl(councilId)]);
  if (!climate && !wdtk) return null;
  const year = climate?.carbonNeutral?.match(/\d{4}/)?.[0] ?? null;
  return (
    <div className="grid gap-x-14 lg:grid-cols-2">
      {climate && (
        <Section title={t.climateTitle} icon="plans">
          <div className="max-w-[62ch] space-y-2">
            {(climate.declaredEmergency || year) && (
              <p>
                {climate.declaredEmergency ? `${t.emergency.replace("{date}", formatDate(locale, climate.declaredEmergency))} ` : ""}
                {year ? t.neutral.replace("{year}", year) : ""}
              </p>
            )}
            {climate.planUrl && climate.planTitle ? (
              <p>
                <a href={climate.planUrl} rel="noopener" lang="en">
                  {t.plan.replace("{title}", climate.planTitle)}
                </a>
              </p>
            ) : climate.planCount === 0 ? (
              <p className="text-ink-2">{t.noPlan}</p>
            ) : null}
            <p>
              <a href={climate.capeUrl} rel="noopener">
                {t.capeLink}
              </a>
            </p>
            <p className="text-meta text-ink-2">{t.climateSource}</p>
          </div>
        </Section>
      )}
      {wdtk && (
        <Section title={t.foiTitle} icon="search">
          <p className="max-w-[62ch]">{t.foi}</p>
          <p className="mt-2">
            <a href={wdtk} rel="noopener" className="font-semibold">
              {t.foiLink.replace("{council}", name)}
            </a>
          </p>
        </Section>
      )}
    </div>
  );
}
