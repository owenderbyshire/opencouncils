import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Section } from "@/components/page-header";
import { MapLegend, NeighbourhoodMap, NeighbourhoodShapes, type MapClass } from "@/components/places/maps";
import { YourArea } from "@/components/places/your-area";
import { BlockSkeleton } from "@/components/skeleton";
import { getArea, getAreasIndex, WIMD_DOMAINS, type Place, type PlaceLsoa, type PlaceSummary, type WimdDomain } from "@/data/places";
import type { Locale } from "@/i18n/config";
import { formatDate, formatNumber, formatPercent } from "@/i18n/format";
import { areaMessages } from "@/i18n/messages/area";
import { common } from "@/i18n/messages/common";
import { Rich } from "@/i18n/rich";
import { getLocale } from "@/i18n/server";
import { councilName, liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { councilFrom } from "@/lib/route";

/*
 * A council area's story told through maps of its neighbourhoods: town and
 * country, Welsh speakers, deprivation and second homes. Figures come from
 * DataMapWales via pipeline/jobs/places.ts. The chapters are OpenSenedd's
 * constituency chapters, copied.
 */

const RANKED = 1917;

type T = (typeof areaMessages)["en"];
type Params = Promise<{ council: string }>;

export async function generateMetadata({ params }: PageProps<"/[lang]/[council]/area">): Promise<Metadata> {
  const locale = await getLocale();
  const c = liveCouncil((await params).council);
  if (!c) return { title: common[locale].notFound.title };
  const t = areaMessages[locale];
  const name = councilName(locale, c);
  return pageMetadata({ locale, path: `/${c.id}/area`, title: fill(t.title, { name }), description: fill(t.metaPlace, { name }) });
}

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

/* Map classes: 5 is the darkest. */
const deprivClass = (rank: number | null): MapClass =>
  rank === null ? 0 : rank <= 192 ? 5 : rank <= 383 ? 4 : rank <= 575 ? 3 : rank <= 958 ? 2 : 1;
const welshClass = (p: number | null): MapClass => (p === null ? 0 : p < 10 ? 1 : p < 20 ? 2 : p < 40 ? 3 : p < 60 ? 4 : 5);
// Built-up areas are the strong colour: they are small on the map but are where most people live.
const settleClass = (s: PlaceLsoa["set"]): MapClass => (s === "urban" ? 5 : s === "town" ? 3 : s === "rural" ? 1 : 0);
const secondClass = (v: PlaceLsoa["second"]): MapClass =>
  v === null ? 0 : v === "few" || v < 10 ? 1 : v < 25 ? 2 : v < 50 ? 3 : v < 100 ? 4 : 5;

export default async function AreaPage({ params }: PageProps<"/[lang]/[council]/area">) {
  const locale = await getLocale();
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={12} label={common[locale].words.loading} />}>
        <Area locale={locale} params={params} />
      </Suspense>
    </div>
  );
}

async function Area({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  const t = areaMessages[locale];
  const [place, index] = await Promise.all([getArea(c.id), getAreasIndex()]);
  const name = councilName(locale, c);
  const hoodName = (l: { en: string; cy: string }) => (locale === "cy" ? l.cy : l.en);
  const pct = (v: number, digits = 0) => formatPercent(locale, v / 100, digits);
  return (
    <>
      <PageHeader
        title={fill(t.title, { name })}
        lede={place ? <Rich text={t.lede1} values={{ n: formatNumber(locale, place.lsoas.length) }} /> : t.notReady}
      >
        {place ? (
          <Suspense>
            <YourArea names={Object.fromEntries(place.lsoas.map((l) => [l.code, hoodName(l)]))} template={t.yourArea} />
          </Suspense>
        ) : null}
      </PageHeader>
      <Section id="why" title={t.whyTitle} className="border-t border-rule">
        <p className="max-w-[66ch] text-ink-2">{t.why}</p>
      </Section>
      {place && index ? (
        <>
          <NeighbourhoodShapes place={place} />
          <Settlement t={t} locale={locale} place={place} wales={index.wales} hoodName={hoodName} />
          <Welsh t={t} place={place} wales={index.wales} hoodName={hoodName} pct={pct} />
          <Deprivation t={t} locale={locale} place={place} hoodName={hoodName} />
          {/* Second homes hidden until a reliable source is in place (see compare page). */}
        </>
      ) : null}
      <About t={t} locale={locale} updatedAt={index?.updatedAt ?? null} />
    </>
  );
}

type HoodName = (l: { en: string; cy: string }) => string;

/** A chapter of the story: words on one side, the map on the other. */
function Chapter({ id, title, children, map }: { id: string; title: string; children: React.ReactNode; map: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid items-start gap-6 border-t border-rule py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-10">
      <div className="space-y-3 text-body lg:sticky lg:top-6">
        <h2 id={`${id}-title`} className="text-h3">
          {title}
        </h2>
        {children}
      </div>
      <div className="space-y-3">{map}</div>
    </section>
  );
}

function Settlement({ t, locale, place, wales, hoodName }: { t: T; locale: Locale; place: Place; wales: PlaceSummary; hoodName: HoodName }) {
  const s = place.summary;
  const n = (v: number) => formatNumber(locale, v);
  return (
    <Chapter
      id="town-and-country"
      title={t.settleTitle}
      map={
        <>
          <NeighbourhoodMap
            place={place}
            label={t.settleTitle}
            classOf={(l) => settleClass(l.set)}
            titleOf={(l) => `${hoodName(l)}: ${l.set ? t[`set_${l.set}`] : t.noFigure}`}
          />
          <MapLegend
            title={t.settleTitle}
            items={[
              { cls: 5, label: t.set_urban },
              { cls: 3, label: t.set_town },
              { cls: 1, label: t.set_rural },
            ]}
          />
        </>
      }
    >
      <p>
        <Rich text={t.settleText} values={{ n: n(s.lsoas), urban: n(s.settlement.urban), town: n(s.settlement.town), rural: n(s.settlement.rural) }} />
      </p>
      <p className="text-ink-2">{fill(t.settleCompare, { rural: formatPercent(locale, wales.settlement.rural / wales.lsoas, 0) })}</p>
    </Chapter>
  );
}

function Welsh({ t, place, wales, hoodName, pct }: { t: T; place: Place; wales: PlaceSummary; hoodName: HoodName; pct: (v: number, d?: number) => string }) {
  const s = place.summary;
  return (
    <Chapter
      id="welsh"
      title={t.welshTitle}
      map={
        <>
          <NeighbourhoodMap
            place={place}
            label={t.welshTitle}
            classOf={(l) => welshClass(l.welsh)}
            titleOf={(l) => `${hoodName(l)}: ${l.welsh === null ? t.noFigure : fill(t.hoodWelsh, { pct: pct(l.welsh, 1) })}`}
          />
          <MapLegend title={t.welshLegend} items={([1, 2, 3, 4, 5] as const).map((c) => ({ cls: c, label: t[`w_${c}`] }))} />
        </>
      }
    >
      {s.welsh !== null && wales.welsh !== null ? (
        <p>
          <Rich text={t.welshText} values={{ pct: pct(s.welsh), wales: pct(wales.welsh) }} />
        </p>
      ) : null}
      <p>{s.welshHigh ? fill(t.welshHigh, { high: s.welshHigh }) : t.welshNone}</p>
      {s.welshTop ? <p className="text-ink-2">{fill(t.welshTop, { name: hoodName(s.welshTop), pct: pct(s.welshTop.value, 1) })}</p> : null}
    </Chapter>
  );
}

function Deprivation({ t, locale, place, hoodName }: { t: T; locale: Locale; place: Place; hoodName: HoodName }) {
  const s = place.summary;
  const n = (v: number) => formatNumber(locale, v);
  const doms = WIMD_DOMAINS.filter((d) => s.domains[d] !== null);
  const sorted = [...doms].sort((a, b) => s.domains[a]! - s.domains[b]!);
  return (
    <Chapter
      id="deprivation"
      title={t.deprivTitle}
      map={
        <>
          <NeighbourhoodMap
            place={place}
            label={t.deprivTitle}
            classOf={(l) => deprivClass(l.wimd)}
            titleOf={(l) => `${hoodName(l)}: ${l.wimd === null ? t.noFigure : fill(t.hoodRank, { rank: n(l.wimd) })}`}
          />
          <MapLegend
            title={t.deprivLegend}
            items={([1, 2, 3, 4, 5] as const).map((i) => ({ cls: (6 - i) as MapClass, label: t[`dep_${i}`] }))}
          />
        </>
      }
    >
      <p className="text-ink-2">{t.deprivIntro}</p>
      <p>
        <Rich text={t.deprivText} values={{ d10: n(s.deprived10), l10: n(s.least10), even: n(Math.round(s.lsoas / 10)) }} />
      </p>
      {s.mostDeprived && s.leastDeprived ? (
        <p>
          {fill(t.deprivEnds, {
            most: hoodName(s.mostDeprived),
            mostRank: n(s.mostDeprived.rank),
            least: hoodName(s.leastDeprived),
            leastRank: n(s.leastDeprived.rank),
          })}
        </p>
      ) : null}
      {sorted.length > 1 ? (
        <div className="pt-3">
          <h3 className="text-h4">{t.domainsTitle}</h3>
          <p className="mt-1 mb-3 text-small text-ink-2">{t.domainsNote}</p>
          <DomainDots t={t} domains={s.domains} />
          <p className="mt-3">
            <Rich
              text={t.domainsWorst}
              values={{ worst: t[`domLower_${sorted[0]}`], best: t[`domLower_${sorted[sorted.length - 1]}`] }}
            />
          </p>
        </div>
      ) : null}
    </Chapter>
  );
}

/** Each domain's middle rank on a line from most deprived (left) to least (right), with the middle of Wales marked. */
function DomainDots({ t, domains }: { t: T; domains: Record<WimdDomain, number | null> }) {
  return (
    <div>
      <div className="mb-1 flex justify-between pl-[7.5rem] sm:pl-[9.5rem] text-meta text-ink-3">
        <span>← {t.domainsMore}</span>
        <span>{t.domainsLess} →</span>
      </div>
      <ul className="space-y-1.5">
        {WIMD_DOMAINS.map((d) => {
          const v = domains[d];
          return (
            <li key={d} className="flex items-center gap-2 text-small">
              <span className="w-[7rem] shrink-0 sm:w-[9rem]">{t[`dom_${d}`]}</span>
              <span className="relative h-4 flex-1">
                <span className="absolute inset-x-0 top-1/2 h-px bg-rule-strong" />
                <span className="absolute top-0 left-1/2 h-4 w-px bg-ink-3" />
                {v !== null ? (
                  <span
                    className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
                    style={{ left: `${((v - 1) / (RANKED - 1)) * 100}%` }}
                  />
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for when a reliable second homes source is in place
function SecondHomes({ t, locale, place, wales, hoodName }: { t: T; locale: Locale; place: Place; wales: PlaceSummary; hoodName: HoodName }) {
  const s = place.summary.secondHomes;
  const n = (v: number) => formatNumber(locale, v, 0);
  const label = (v: PlaceLsoa["second"]) => (v === null ? t.noFigure : v === "few" ? t.sh_1 : n(v));
  return (
    <Chapter
      id="second-homes"
      title={t.secondTitle}
      map={
        <>
          <NeighbourhoodMap
            place={place}
            label={t.secondTitle}
            classOf={(l) => secondClass(l.second)}
            titleOf={(l) => `${hoodName(l)}: ${label(l.second)}`}
          />
          <MapLegend
            title={t.secondLegend}
            items={[
              ...([1, 2, 3, 4, 5] as const).map((c) => ({ cls: c as MapClass, label: t[`sh_${c}`] })),
              ...(!s || s.missing ? [{ cls: 0 as MapClass, label: t.noFigure }] : []),
            ]}
          />
        </>
      }
    >
      {s?.medianFew && wales.secondHomes ? (
        <p>
          <Rich text={t.secondFew} values={{ few: n(s.few ?? 0), areas: n(s.areas), wales: n(wales.secondHomes.median) }} />
        </p>
      ) : s && wales.secondHomes ? (
        <>
          <p>
            <Rich text={t.secondText} values={{ median: n(s.median), wales: n(wales.secondHomes.median) }} />
          </p>
          <p>{s.over50 ? fill(t.secondOver, { over: s.over50, areas: s.areas }) : t.secondNone}</p>
        </>
      ) : null}
      {!s ? <p>{t.secondNone2}</p> : null}
      {s?.missing ? <p>{fill(t.secondMissing, { missing: s.missing })}</p> : null}
      {place.slug === "swansea" || place.slug === "pembrokeshire" ? <p className="text-small text-ink-2">{t.secondDate}</p> : null}
      <p className="text-small text-ink-2">{t.secondNote}</p>
    </Chapter>
  );
}

const SOURCES: Array<{ key: "src_lsoa" | "src_wimd" | "src_welsh" | "src_ruc" | "src_second"; url: string }> = [
  { key: "src_lsoa", url: "https://datamap.gov.wales/layers/geonode:lsoa_2021_w_hwm" },
  { key: "src_wimd", url: "https://www.gov.wales/welsh-index-multiple-deprivation" },
  { key: "src_welsh", url: "https://datamap.gov.wales/layers/geonode:welsh_language_2021" },
  { key: "src_ruc", url: "https://datamap.gov.wales/layers/geonode:ruc_lsoa_2021" },
  { key: "src_second", url: "https://datamap.gov.wales/layers/geonode:second_homes_per_1000_ct_chargeable_homes_msoa_march_2023" },
];

function About({ t, locale, updatedAt }: { t: T; locale: Locale; updatedAt: string | null }) {
  return (
    <Section id="about" title={t.aboutTitle} className="border-t border-rule">
      <div className="max-w-[66ch] space-y-3 text-small text-ink-2">
        <p>{t.about1}</p>
        <p>
          {t.about2} {updatedAt ? fill(t.updated, { date: formatDate(locale, updatedAt.slice(0, 10)) }) : null}
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {SOURCES.map((s) => (
            <li key={s.key}>
              <a href={s.url}>{t[s.key]}</a>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
