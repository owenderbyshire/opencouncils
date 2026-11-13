import { CouncilCabinetBlock } from "@/components/cabinet";
import { CouncilBrief } from "@/components/council-brief";
import { ComingToCabinetBlock } from "@/components/planned";
import { CouncilMoney, CouncilRisks } from "@/components/council-papers";
import { FollowLinks } from "@/components/follow-links";
import { COUNCIL_SEATS } from "@data/curated/council-seats";
import { onsCodeFor } from "@/data/postcode";
import { familyUrl } from "@/lib/site";
import { softMutate, ynPlace } from "@/i18n/welsh";
import { getAreasIndex } from "@/data/places";
import { BandDRange } from "@/components/band-d-range";
import { engageMessages } from "@/i18n/messages/engage";
import { followMessages } from "@/i18n/messages/follow";
import { walesMessages } from "@/i18n/messages/wales";
import { Rich } from "@/i18n/rich";
import type { Metadata } from "next";
import Link from "next/link";
import { CompareLinks } from "@/components/compare-links";
import { Suspense } from "react";
import { MeetingItem } from "@/components/meeting-item";
import { ConsultationItem } from "@/components/consultations";
import { PageHeader, Section } from "@/components/page-header";
import { openConsultations } from "@/data/consultations";
import { consultationPage } from "@data/curated/consultation-pages";
import { consultationMessages } from "@/i18n/messages/consultations";
import { BlockSkeleton, ListSkeleton } from "@/components/skeleton";
import { councilCabinet } from "@/data/cabinets";
import { councilFacts, hasMeetings, recentlySummarised, upcomingMeetings } from "@/data/council";
import { forwardPlanCoverage } from "@/data/forward-plans";
import { href, type Locale } from "@/i18n/config";
import { formatNumber, formatPercent } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { councilMessages } from "@/i18n/messages/council";
import { getLocale } from "@/i18n/server";
import { councilName, liveCouncil, type CouncilConfig } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { controlText } from "@/lib/elections";
import { partyName } from "@/lib/parties";
import { electionFor } from "@data/curated/elections";
import { electionMessages } from "@/i18n/messages/elections";
import { councilFrom } from "@/lib/route";
import { rowsFor } from "@/components/seats";
import { Chamber, chamberGroups } from "@/components/chamber";
import { graphicsMessages } from "@/i18n/messages/graphics";
import { seatsNow } from "@/data/elections";

type Params = Promise<{ council: string }>;

export async function generateMetadata({ params }: PageProps<"/[lang]/[council]">): Promise<Metadata> {
  const locale = await getLocale();
  const c = liveCouncil((await params).council);
  if (!c) return { title: common[locale].notFound.title };
  const name = councilName(locale, c);
  return pageMetadata({
    locale,
    path: `/${c.id}`,
    title: name,
    description: councilMessages[locale].overview.lede.replace("{name}", name),
  });
}

export default async function CouncilPage({ params }: PageProps<"/[lang]/[council]">) {
  const locale = await getLocale();
  const loading = common[locale].words.loading;
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={2} label={loading} />}>
        <Header locale={locale} params={params} />
      </Suspense>
      <Suspense fallback={null}>
        <Overview locale={locale} params={params} />
      </Suspense>
      <Suspense fallback={<BlockSkeleton lines={4} label={loading} />}>
        <Seats locale={locale} params={params} />
      </Suspense>
      <Suspense fallback={null}>
        <WhoAndWhat locale={locale} params={params} />
      </Suspense>
      <Suspense fallback={<ListSkeleton rows={6} label={loading} />}>
        <Body locale={locale} params={params} />
        <More locale={locale} params={params} />
        <Elsewhere locale={locale} params={params} />
      </Suspense>
    </div>
  );
}

async function Header({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  const t = councilMessages[locale].overview;
  const facts = await councilFacts(c.id);
  const name = councilName(locale, c);
  return (
    <PageHeader title={name} lede={t.lede.replace("{name}", name)}>
      {facts.councillors ? (
        <p className="text-small text-ink-2">
          {(facts.wards ? t.facts : t.factsNoWards)
            .replace("{councillors}", formatNumber(locale, facts.councillors))
            .replace("{wards}", formatNumber(locale, facts.wards))}{" "}
          <OfficialLink c={c} text={t.officialSite} />
        </p>
      ) : (
        <p className="text-small text-ink-2">
          <OfficialLink c={c} text={t.officialSite} />
        </p>
      )}
      <ElectionLine locale={locale} councilId={c.id} />
    </PageHeader>
  );
}

function ElectionLine({ locale, councilId }: { locale: Locale; councilId: string }) {
  const e = electionFor(councilId);
  if (!e) return null;
  const t = electionMessages[locale];
  const leader = `${e.leader.name} (${e.leader.party === "ind" ? t.independent : partyName(locale, e.leader.party, null)})`;
  return (
    <p className="mt-2 max-w-[62ch] text-small">
      <Rich text={t.overviewLine.replace("{control}", controlText(locale, e)).replace("{leader}", leader)} links={{ e: href(locale, `/elections/${councilId}`) }} />
    </p>
  );
}

/** The council's chamber now: one dot per seat, by party or group, from its own list of current councillors. */
async function Seats({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  const groups = chamberGroups(locale, rowsFor(await seatsNow(), c.id), electionFor(c.id)?.election2022.total ?? null);
  if (!groups.length) return null;
  return (
    <Section id="chamber" icon="council" title={graphicsMessages[locale].chamber.title} className="border-t border-rule">
      <Chamber locale={locale} name={councilName(locale, c)} groups={groups} />
    </Section>
  );
}

function OfficialLink({ c, text }: { c: CouncilConfig; text: string }) {
  return c.recordsUrl ? (
    <a href={c.recordsUrl} rel="noopener">
      {text}
    </a>
  ) : null;
}

async function Overview({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  return (
    <>
      <CouncilBrief locale={locale} councilId={c.id} />
      <CouncilMoney locale={locale} councilId={c.id} moreLink />
      <CouncilRisks locale={locale} councilId={c.id} />
    </>
  );
}

/** Who runs the council, and what it has said is coming to its Cabinet: each shown only where the council's records give it. */
async function WhoAndWhat({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  const [cabinet, coverage] = await Promise.all([councilCabinet(c.id), forwardPlanCoverage()]);
  const hasCabinet = Boolean(cabinet?.members.length);
  const hasPlan = coverage.some((x) => x.councilId === c.id && x.shown);
  if (!hasCabinet && !hasPlan) return null;
  // Side by side only when both are there: one alone takes the full width.
  return (
    <div className={hasCabinet && hasPlan ? "grid gap-x-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : undefined}>
      <CouncilCabinetBlock locale={locale} councilId={c.id} />
      <ComingToCabinetBlock locale={locale} councilId={c.id} />
    </div>
  );
}

async function Body({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  const t = councilMessages[locale].overview;
  const [upcoming, recent, loadedMeetings] = await Promise.all([upcomingMeetings(c.id, 6), recentlySummarised(c.id, 8), hasMeetings(c.id)]);
  return (
    <div className="grid gap-x-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Section id="recent" icon="decisions" title={t.recent} className="border-t border-rule">
        {recent.length ? (
          <div className="rows">
            {recent.map((r) => (
              <MeetingItem key={r.id} locale={locale} row={r} />
            ))}
          </div>
        ) : (
          <p className="max-w-[62ch] text-ink-2">{t.recentNone}</p>
        )}
      </Section>
      <Section
        id="upcoming"
        icon="meetings"
        title={t.upcoming}
        className="border-t border-rule"
        aside={<Link href={href(locale, `/${c.id}/meetings`)}>{t.allMeetings}</Link>}
      >
        {upcoming.length ? (
          <div className="rows">
            {upcoming.map((r) => (
              <MeetingItem key={r.id} locale={locale} row={r} showOverview={false} />
            ))}
          </div>
        ) : (
          <p className="text-ink-2">{loadedMeetings ? t.upcomingNone : t.meetingsNotLoaded}</p>
        )}
      </Section>
    </div>
  );
}

async function More({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  const e = engageMessages[locale];
  const w = walesMessages[locale].compare;
  const a = councilMessages[locale].overview;
  const area = (await getAreasIndex())?.councils.find((x) => x.slug === c.id)?.summary;
  const share = (n: number) => (area && area.lsoas ? formatPercent(locale, n / area.lsoas) : "–");
  const figures = area
    ? [
        [w.cols.welsh, area.welsh == null ? "–" : formatPercent(locale, area.welsh / 100)],
        [w.cols.deprivedLong, share(area.deprived10)],
        [w.cols.rural, share(area.settlement.rural + area.settlement.town)],
      ]
    : [];
  return (
    <div className="grid gap-x-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Section
        id="area"
        icon="area"
        title={a.areaTitle}
        className="border-t border-rule"
        aside={<Link href={href(locale, `/${c.id}/area`)}>{a.areaLink}</Link>}
      >
        {figures.length ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            {figures.map(([label, value]) => (
              <div key={label} className="border-t-2 border-accent pt-2">
                <dt className="text-small text-ink-2">{label}</dt>
                <dd className="font-serif text-h3 num">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-ink-2">{a.areaWaiting}</p>
        )}
        <div className="mt-6 max-w-[24rem]">
          <BandDRange locale={locale} councilId={c.id} link />
        </div>
        <p className="mt-4 text-small">
          <Link href={href(locale, "/compare")}>{a.compareLink}</Link>
        </p>
        <div className="mt-2">
          <CompareLinks locale={locale} />
        </div>
      </Section>
      <Section id="have-your-say" icon="have" title={e.title} className="border-t border-rule">
        <p className="max-w-[62ch]">
          <Rich text={e.election} />
        </p>
        <ul className="mt-4 space-y-2">
          <li>
            <Link href={href(locale, "/find")} className="font-semibold">
              {e.findCouncillors}
            </Link>
          </li>
          <li>
            <Link href={`${href(locale, "/follow")}?council=${c.id}`} className="font-semibold">
              {followMessages[locale].title}
            </Link>
          </li>
          <li>
            <Link href={href(locale, "/guide#have-your-say")}>{e.howCouncilsWork}</Link>
          </li>
        </ul>
        <OpenConsultations locale={locale} councilId={c.id} />
        <div className="mt-6">
          <FollowLinks locale={locale} ics={`/feeds/${c.id}.ics`} />
        </div>
      </Section>
    </div>
  );
}

async function OpenConsultations({ locale, councilId }: { locale: Locale; councilId: string }) {
  const t = consultationMessages[locale];
  const all = await openConsultations();
  const mine = all.filter((x) => x.councilId === councilId);
  const about = all.filter((x) => x.source === "gov" && x.aboutCouncils);
  const list = [...mine, ...about].slice(0, 4);
  const own = consultationPage(councilId, locale);
  return (
    <div className="mt-6 border-t border-rule pt-4">
      <h3 className="text-h4">{t.panelTitle}</h3>
      {list.length ? (
        <ul className="rows">
          {list.map((x) => (
            <ConsultationItem key={x.url} locale={locale} c={x} summary={false} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-small text-ink-2">{t.panelNone}</p>
      )}
      <ul className="mt-3 space-y-1 text-small">
        {own ? (
          <li>
            <a href={own} rel="noopener">
              {t.councilOwn}
            </a>
          </li>
        ) : null}
        <li>
          <Link href={href(locale, "/consultations")}>{t.panelMore}</Link>
        </li>
      </ul>
    </div>
  );
}

/** The same area on the sibling sites, by its ONS code or the sibling's own slug: plain links, nothing fetched. */
async function Elsewhere({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  const a = councilMessages[locale].overview;
  const code = onsCodeFor(c.id);
  if (!code) return null;
  const cy = locale === "cy";
  const name = cy ? c.shortCy : c.shortEn;
  const links = [
    { key: "openeconomy", href: `${familyUrl("openeconomy", locale)}/local-authority/${code}`, text: a.elsewhereEconomy.replace("{name}", name) },
    ...(COUNCIL_SEATS[code] ?? []).map((s) => ({
      key: s.slug,
      href: `${familyUrl("opensenedd", locale)}/constituencies/${s.slug}`,
      text: a.elsewhereSenedd.replace("{seat}", cy ? softMutate(s.name) : s.name),
    })),
    {
      key: "opencharity",
      href: `${familyUrl("opencharity", locale)}/charities?council=${code}`,
      text: a.elsewhereCharity.replace("{name}", name).replace("{yn}", ynPlace(name)),
    },
  ];
  return (
    <Section id="elsewhere" title={a.elsewhere} className="border-t border-rule">
      <ul className="rows max-w-[44rem]">
        {links.map((l) => (
          <li key={l.key} className="py-2.5">
            <a href={l.href} rel="noopener">
              {l.text}
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}
