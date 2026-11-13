import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CabinetRows, ChairRows, Holder, missingPortfolios, Portfolio, sortName, topicLeads } from "@/components/cabinet";
import { Figures } from "@/components/figures";
import { FilterForm } from "@/components/filter-form";
import { PageHeader, Section } from "@/components/page-header";
import { queryString } from "@/components/pagination";
import { ListSkeleton } from "@/components/skeleton";
import { allCabinets, type CouncilCabinet } from "@/data/cabinets";
import { PORTFOLIO_TOPIC_RULES } from "@data/curated/portfolio-topics";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatList, formatNumber } from "@/i18n/format";
import { cabinetMessages } from "@/i18n/messages/cabinets";
import { common } from "@/i18n/messages/common";
import { Rich } from "@/i18n/rich";
import { getLocale } from "@/i18n/server";
import { councilConfig, councilName, liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { param, type SearchParams } from "@/lib/params";
import { isNationalParty, partyName } from "@/lib/parties";
import { SITE } from "@/lib/site";
import { TOPIC_BY_SLUG, topicName } from "@/lib/topics";

/*
 * Who holds what, across all 22 councils. With no choice made the page shows
 * its figures, the leaders by party and the first few leaders. Choosing a
 * council shows that council's Cabinet in full; choosing a topic shows who
 * leads on it in every council. Every view has its own address.
 */

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

/** Every role as a spreadsheet, from the open data API: a file to download, so a plain link. */
const ROLES_CSV = "/api/v1/cabinets?format=csv";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = cabinetMessages[locale];
  return pageMetadata({ locale, path: "/cabinets", title: t.title, description: t.description });
}

export default async function CabinetsPage({ searchParams }: PageProps<"/[lang]/cabinets">) {
  const locale = await getLocale();
  const t = cabinetMessages[locale];
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede} />
      <Suspense fallback={<ListSkeleton rows={6} label={common[locale].words.loading} />}>
        <Body locale={locale} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </div>
  );
}

async function Body({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const t = cabinetMessages[locale];
  const councilRaw = param(sp, "council");
  const council = councilRaw && liveCouncil(councilRaw) ? councilRaw : undefined;
  const topicRaw = param(sp, "topic");
  const topic = topicRaw && TOPIC_BY_SLUG.has(topicRaw) ? topicRaw : undefined;
  const all = await allCabinets();
  const one = council ? all.find((c) => c.councilId === council) : undefined;
  return (
    <>
      {!council && !topic ? <Summary locale={locale} all={all} /> : null}
      <div className="border-t border-rule pt-6">
        <p className="mb-3 max-w-[62ch] text-small text-ink-2">{t.choose}</p>
        <FilterForm locale={locale} path="/cabinets" council={council} topic={topic} />
      </div>
      {one ? <CouncilView locale={locale} c={one} topic={topic} /> : topic ? <TopicView locale={locale} all={all} topic={topic} /> : <Leaders locale={locale} all={all} />}
      <Method locale={locale} all={all} />
    </>
  );
}

/**
 * The page's figures and its lead. The lead counts the leaders these records name by party: national parties by name,
 * independents and local groups together. A second sentence names the councils whose records name no leader.
 */
function Summary({ locale, all }: { locale: Locale; all: CouncilCabinet[] }) {
  const t = cabinetMessages[locale];
  const members = all.flatMap((c) => c.members);
  const leaders = members.filter((m) => m.role === "leader");
  const chairs = all.reduce((n, c) => n + c.chairs.length, 0);
  const read = all.map((c) => c.readOn).filter((d): d is string => Boolean(d)).sort();
  const national = new Map<string, number>();
  let local = 0;
  let unrecorded = 0;
  for (const l of leaders) {
    if (isNationalParty(l.partyId)) national.set(l.partyId!, (national.get(l.partyId!) ?? 0) + 1);
    else if (l.partyId === "ind" || (l.partyLabel?.trim() && l.partyLabel.trim() !== "No party recorded")) local++;
    else unrecorded++;
  }
  const part = (n: number, one: string, many: string, party = "") => fill(n === 1 ? one : many, { n: formatNumber(locale, n), party });
  const parts = [
    ...[...national]
      .map(([id, n]) => ({ n, name: partyName(locale, id, null) }))
      .sort((x, y) => y.n - x.n || x.name.localeCompare(y.name, locale))
      .map((x) => part(x.n, t.leadPartOne, t.leadPart, x.name)),
    ...(local ? [part(local, t.leadLocalOne, t.leadLocal)] : []),
    ...(unrecorded ? [part(unrecorded, t.leadNoPartyOne, t.leadNoParty)] : []),
  ];
  const unnamed = all.filter((c) => !c.members.some((m) => m.role === "leader")).map((c) => sortName(locale, c.councilId)).sort((x, y) => x.localeCompare(y, locale));
  return (
    <div className="pb-8">
      <Figures
        items={[
          { value: formatNumber(locale, members.length), label: t.figures.members },
          { value: fill(t.figures.leadersValue, { n: formatNumber(locale, leaders.length), total: formatNumber(locale, all.length) }), label: t.figures.leaders },
          { value: formatNumber(locale, members.filter((m) => m.portfolio).length), label: t.figures.portfolios },
          { value: formatNumber(locale, chairs), label: t.figures.chairs },
        ]}
      />
      <p className="mt-6 max-w-[62ch] text-read">
        {leaders.length ? fill(t.lead, { n: formatNumber(locale, leaders.length), list: formatList(locale, parts) }) : t.leadNone}
        {leaders.length && unnamed.length ? ` ${unnamed.length <= 5 ? fill(t.leadMissing, { councils: formatList(locale, unnamed, { places: true }) }) : fill(t.leadMissingMany, { n: formatNumber(locale, unnamed.length) })}` : ""}
      </p>
      {read.length ? (
        <p className="mt-2 text-meta text-ink-2">
          {read[0] === read.at(-1) ? fill(t.readOnDay, { date: formatDate(locale, read[0]) }) : fill(t.readBetween, { from: formatDate(locale, read[0]), to: formatDate(locale, read.at(-1)) })}
        </p>
      ) : null}
    </div>
  );
}

const councilLink = (locale: Locale, council: string, topic?: string) => href(locale, "/cabinets") + queryString({ council, topic });

/** Every council's leader: the first eight, the rest one click away. */
function Leaders({ locale, all }: { locale: Locale; all: CouncilCabinet[] }) {
  const t = cabinetMessages[locale];
  const sorted = [...all].sort((a, b) => sortName(locale, a.councilId).localeCompare(sortName(locale, b.councilId), locale));
  const table = (list: CouncilCabinet[], head: boolean) => (
    <table className="data-table data-table-stack">
      <thead className={head ? undefined : "visually-hidden"}>
        <tr>
          <th scope="col">{t.cols.council}</th>
          <th scope="col">{t.cols.leader}</th>
          <th scope="col">{t.cols.portfolio}</th>
        </tr>
      </thead>
      <tbody>
        {list.map((c) => {
          const leader = c.members.find((m) => m.role === "leader");
          return (
            <tr key={c.councilId}>
              <th scope="row" className="sm:w-[14rem]">
                <Link href={councilLink(locale, c.councilId)} scroll={false}>
                  {sortName(locale, c.councilId)}
                </Link>
              </th>
              {leader ? (
                <>
                  <td data-label={t.cols.leader} className="sm:w-[16rem]">
                    <Holder locale={locale} councilId={c.councilId} p={leader} />
                  </td>
                  <td data-label={t.cols.portfolio}>
                    <Portfolio locale={locale} m={leader} />
                  </td>
                </>
              ) : (
                <td colSpan={2} className="text-ink-2">
                  {t.leaderUnknown}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
  return (
    <Section id="leaders" title={t.leadersTitle} className="mt-8 border-t border-rule">
      {table(sorted.slice(0, 8), true)}
      {sorted.length > 8 ? (
        <details className="border-t border-rule">
          <summary className="cursor-pointer py-3 text-small">{fill(t.leadersAll, { n: formatNumber(locale, sorted.length) })}</summary>
          <div className="border-t border-rule">{table(sorted.slice(8), false)}</div>
        </details>
      ) : null}
    </Section>
  );
}

/** One council's Cabinet in full, then its committee chairs, then where it comes from. */
function CouncilView({ locale, c, topic }: { locale: Locale; c: CouncilCabinet; topic?: string }) {
  const t = cabinetMessages[locale];
  const council = councilConfig(c.councilId)!;
  const name = councilName(locale, council);
  const members = topic ? c.members.filter((m) => m.topics.includes(topic)) : c.members;
  const missing = missingPortfolios(locale, c);
  // Why nobody is listed, when nobody is.
  const none =
    topic && c.members.length
      ? t.bothNone
      : council.system === "vale"
        ? (missing ?? t.cabinetPageUnread)
        : c.cabinet
          ? t.councilNoMembers
          : t.councilNoCabinet;
  return (
    <>
      <Section
        id="cabinet"
        title={topic ? `${fill(t.councilTitle, { name })}: ${topicName(locale, topic)}` : fill(t.councilTitle, { name })}
        className="mt-8 border-t border-rule"
        aside={
          <Link href={href(locale, "/cabinets") + queryString({ topic })} scroll={false}>
            {t.allCouncils}
          </Link>
        }
      >
        {members.length ? (
          <CabinetRows locale={locale} councilId={c.councilId} members={members} noPosts={!c.members.some((m) => m.posts.length)} />
        ) : (
          <p className="max-w-[62ch] text-ink-2">{none}</p>
        )}
        {topic && c.members.length ? (
          <p className="mt-3 text-small">
            <Link href={councilLink(locale, c.councilId)} scroll={false}>
              {t.seeCabinet}
            </Link>
          </p>
        ) : null}
        <div className="mt-4 max-w-[68ch] space-y-1 text-meta text-ink-2">
          {missing && !topic && c.members.length ? <p>{missing}</p> : null}
          {c.readOn ? <p>{fill(t.sourceLine, { name, date: formatDate(locale, c.readOn) })}</p> : null}
          {c.postsReadOn ? <p>{fill(council.system === "vale" ? t.sourceCabinetPage : t.sourcePosts, { date: formatDate(locale, c.postsReadOn) })}</p> : null}
          <p>
            {c.officialUrl ? (
              <a href={c.officialUrl} rel="noopener">
                {t.officialCabinet}
              </a>
            ) : null}
            {c.officialUrl ? ". " : ""}
            <Link href={href(locale, `/${c.councilId}`)}>{name}</Link>
          </p>
        </div>
      </Section>
      {!topic ? (
        <Section id="chairs" title={t.chairsTitle} className="border-t border-rule">
          <p className="-mt-1 mb-2 max-w-[62ch] text-small text-ink-2">{t.chairsLede}</p>
          {c.chairs.length ? <ChairRows locale={locale} councilId={c.councilId} chairs={c.chairs} /> : <p className="text-ink-2">{t.chairsNone}</p>}
        </Section>
      ) : null}
    </>
  );
}

/** Everyone in a Welsh Cabinet whose portfolio is named for one topic, council by council. */
function TopicView({ locale, all, topic }: { locale: Locale; all: CouncilCabinet[]; topic: string }) {
  const t = cabinetMessages[locale];
  const leads = topicLeads(all, topic).sort((a, b) => sortName(locale, a.councilId).localeCompare(sortName(locale, b.councilId), locale) || a.m.name.localeCompare(b.m.name, locale));
  const withLead = new Set(leads.map((l) => l.councilId));
  const byName = (a: CouncilCabinet, b: CouncilCabinet) => sortName(locale, a.councilId).localeCompare(sortName(locale, b.councilId), locale);
  // Councils whose records name portfolios, none of them for this topic; and councils whose records name none at all, which can't be matched.
  const without = all.filter((c) => !withLead.has(c.councilId) && c.members.some((m) => m.portfolio)).sort(byName);
  const unknown = all.filter((c) => !c.members.some((m) => m.portfolio)).sort(byName);
  const councilList = (list: CouncilCabinet[]) =>
    list.map((c, i) => (
      <span key={c.councilId}>
        {i ? ", " : " "}
        <Link href={councilLink(locale, c.councilId)} scroll={false}>
          {sortName(locale, c.councilId)}
        </Link>
      </span>
    ));
  // Ten rows on first view, the rest one click away.
  const leadTable = (list: typeof leads, head: boolean) => (
    <table className="data-table data-table-stack">
      <thead className={head ? undefined : "visually-hidden"}>
        <tr>
          <th scope="col">{t.cols.council}</th>
          <th scope="col">{t.cols.name}</th>
          <th scope="col">{t.cols.portfolio}</th>
        </tr>
      </thead>
      <tbody>
        {list.map(({ councilId, m }) => (
          <tr key={`${councilId}-${m.councillorId}`}>
            <th scope="row" className="sm:w-[14rem]">
              <Link href={councilLink(locale, councilId)} scroll={false}>
                {sortName(locale, councilId)}
              </Link>
            </th>
            <td data-label={t.cols.name} className="sm:w-[16rem]">
              <Holder locale={locale} councilId={councilId} p={m} />
            </td>
            <td data-label={t.cols.portfolio}>
              <Portfolio locale={locale} m={m} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <Section
      id="topic"
      title={fill(t.topicTitle, { topic: topicName(locale, topic) })}
      className="mt-8 border-t border-rule"
      aside={
        <Link href={href(locale, "/cabinets")} scroll={false}>
          {t.allCouncils}
        </Link>
      }
    >
      <p className="-mt-1 mb-3 max-w-[62ch] text-small text-ink-2">
        {t.topicLede}{" "}
        {leads.length
          ? leads.length === 1
            ? t.topicCountOne
            : fill(t.topicCount, { n: formatNumber(locale, leads.length), councils: formatNumber(locale, withLead.size) })
          : ""}
        {leads.length ? "." : ""}
      </p>
      {leads.length ? (
        <>
          {leadTable(leads.slice(0, 10), true)}
          {leads.length > 10 ? (
            <details className="border-t border-rule">
              <summary className="cursor-pointer py-3 text-small">{fill(t.topicAll, { n: formatNumber(locale, leads.length) })}</summary>
              <div className="border-t border-rule">{leadTable(leads.slice(10), false)}</div>
            </details>
          ) : null}
        </>
      ) : (
        <p className="text-ink-2">{t.topicNone}</p>
      )}
      {leads.length && without.length ? (
        <p className="mt-4 max-w-[68ch] text-small text-ink-2">
          {t.topicMissing}
          {councilList(without)}.
        </p>
      ) : null}
      {unknown.length ? (
        <p className="mt-2 max-w-[68ch] text-small text-ink-2">
          {t.topicUnknown}
          {councilList(unknown)}.
        </p>
      ) : null}
    </Section>
  );
}

/** Where the list comes from, the words that match portfolios to topics, each council's records, and the download: all folded away. */
function Method({ locale, all }: { locale: Locale; all: CouncilCabinet[] }) {
  const t = cabinetMessages[locale];
  const source = (c: CouncilCabinet) => {
    if (!c.members.length) return t.coverageNoCabinet;
    const kinds = new Set(c.members.filter((m) => m.portfolio).map((m) => m.source));
    if (kinds.has("key-posts") && kinds.has("executive-posts")) return t.coverageBoth;
    if (kinds.has("key-posts")) return t.coverageKey;
    if (kinds.has("executive-posts")) return t.coveragePosts;
    return t.coverageNone;
  };
  const sorted = [...all].sort((a, b) => sortName(locale, a.councilId).localeCompare(sortName(locale, b.councilId), locale));
  return (
    <section className="mt-8 border-t border-rule py-8">
      <p className="text-small">
        <a href={ROLES_CSV} className="font-semibold">
          {t.download}
        </a>
      </p>
      <p className="mt-1 max-w-[62ch] text-meta text-ink-2">
        <Rich text={t.downloadNote} links={{ api: href(locale, "/data") }} />
      </p>
      <details className="mt-5 max-w-[68ch]">
        <summary className="cursor-pointer text-small font-semibold">{t.methodTitle}</summary>
        <div className="mt-3 space-y-3 text-small">
          {t.method.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p>
            <Rich text={t.problem} values={{ email: SITE.contactEmail }} links={{ email: `mailto:${SITE.contactEmail}` }} />
          </p>
        </div>
      </details>
      <details className="mt-3 max-w-[68ch]">
        <summary className="cursor-pointer text-small font-semibold">{t.topicMethodTitle}</summary>
        <div className="mt-3 text-small">
          <p>{t.topicMethod}</p>
          <dl className="mt-3 space-y-2">
            {PORTFOLIO_TOPIC_RULES.map((r) => (
              <div key={r.topic}>
                <dt className="font-semibold">
                  <Link href={href(locale, "/cabinets") + queryString({ topic: r.topic })}>{topicName(locale, r.topic)}</Link>
                </dt>
                <dd className="text-ink-2">
                  <span lang={locale === "cy" ? "en" : undefined}>{r.words.join(", ")}</span>
                  {r.not ? (
                    <>
                      {" "}
                      ({t.topicMethodNot} <span lang={locale === "cy" ? "en" : undefined}>{r.not.join(", ")}</span>)
                    </>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </details>
      <details className="mt-3">
        <summary className="cursor-pointer text-small font-semibold">{t.coverageTitle}</summary>
        <table className="data-table mt-3 max-w-[44rem]">
          <thead>
            <tr>
              <th scope="col">{t.coverageCols.council}</th>
              <th scope="col">{t.coverageCols.portfolios}</th>
              <th scope="col">{t.coverageCols.read}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.councilId}>
                <th scope="row">
                  <Link href={councilLink(locale, c.councilId)}>{sortName(locale, c.councilId)}</Link>
                </th>
                <td>{source(c)}</td>
                <td className="whitespace-nowrap">{c.readOn ? formatDate(locale, c.readOn, "short") : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
