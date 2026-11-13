import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { queryString } from "@/components/pagination";
import { PageHeader, Section } from "@/components/page-header";
import { BlockSkeleton } from "@/components/skeleton";
import { applicationsOnSites, authoritiesWithAreas, ldpDetail, planMeetings, planToday, type LdpFact, type LdpKind, type LdpPoint, type LdpSite } from "@/data/ldp";
import { ldpFor, LDPS, type LdpRecord } from "@data/curated/ldps";
import { planningAuthority } from "@data/curated/planning-authorities";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { plansMessages } from "@/i18n/messages/plans";
import { getLocale } from "@/i18n/server";
import { liveCouncil } from "@/lib/councils";
import { nextStepText, periodEnded, shownFact, planDate, replacementUnderWay, STAGE_ORDER } from "@/lib/ldp";
import { pageMetadata } from "@/lib/metadata";
import { atLeastOne, oneOf, type SearchParams } from "@/lib/params";

/*
 * One authority's local development plan: the plan in force, its headline
 * figures and allocated sites (read by pipeline/jobs/ldp.ts, each citing its
 * page), the latest monitoring figures, progress on a new plan, and the
 * council's meetings about it.
 */

const USES = ["housing", "employment", "mixed", "gypsy-traveller", "other"] as const;
const PLAN_FACTS = ["housing-requirement", "housing-provision", "affordable-target", "employment-land"] as const;
const AMR_FACTS = ["completions-year", "completions-total", "affordable-completions-year"] as const;

export function generateStaticParams() {
  return atLeastOne(LDPS.slice(0, 3).map((l) => ({ authority: l.id })), { authority: "cardiff" });
}

export async function generateMetadata({ params }: PageProps<"/[lang]/planning/plans/[authority]">): Promise<Metadata> {
  const locale = await getLocale();
  const { authority } = await params;
  const a = planningAuthority(authority);
  if (!a || !ldpFor(authority)) return { title: common[locale].notFound.title };
  const t = plansMessages[locale];
  const name = locale === "cy" ? a.nameCy : a.nameEn;
  return pageMetadata({ locale, path: `/planning/plans/${a.id}`, title: `${t.title}: ${name}`, description: t.detail.lede.replace("{name}", name) });
}

export default async function PlanPage({ params, searchParams }: PageProps<"/[lang]/planning/plans/[authority]">) {
  const locale = await getLocale();
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={14} label={common[locale].words.loading} />}>
        <Body locale={locale} params={params} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </div>
  );
}

function unitFor(key: string): "homes" | "hectares" {
  return key === "employment-land" ? "hectares" : "homes";
}

function FactValue({ locale, f }: { locale: Locale; f: LdpFact }) {
  const t = plansMessages[locale];
  const n = formatNumber(locale, f.value, Number.isInteger(f.value) ? 0 : 1);
  return (
    <>
      <span className="num font-semibold">{t.units[unitFor(f.key)].replace("{n}", n)}</span>{" "}
      <a href={`${f.url}#page=${f.page}`} rel="noopener" className="text-meta text-ink-2" title={f.quote}>
        {t.detail.page.replace("{n}", String(f.page))}
      </a>
    </>
  );
}

async function Body({ locale, params, searchParams }: { locale: Locale; params: Promise<{ authority: string }>; searchParams: Promise<SearchParams> }) {
  const { authority } = await params;
  const a = planningAuthority(authority);
  const ldp = ldpFor(authority);
  if (!a || !ldp) notFound();
  const sp = await searchParams;
  const t = plansMessages[locale];
  const d = t.detail;
  const name = locale === "cy" ? a.nameCy : a.nameEn;
  const today = await planToday();
  const council = a.councilId ? liveCouncil(a.councilId) : null;
  const [detail, meetings, withAreas] = await Promise.all([ldpDetail(a.id), council ? planMeetings(council.id) : Promise.resolve([]), authoritiesWithAreas()]);
  const onSites = withAreas.includes(a.id) ? await applicationsOnSites(a.id) : null;
  const factFor = (kind: LdpKind, key: string) => shownFact(detail.facts, kind, key);
  const hasDeposit = detail.facts.some((f) => f.kind === "deposit") || detail.sites.some((s) => s.kind === "deposit");
  const problems = detail.documents.filter((x) => x.problem);

  return (
    <>
      <PageHeader title={`${t.title}: ${name}`} lede={d.lede.replace("{name}", name)}>
        <p className="flex flex-wrap gap-x-4 text-small">
          <Link href={href(locale, "/planning/plans")}>{d.allPlans}</Link>
          <Link href={href(locale, council ? `/${council.id}/planning` : `/planning/${a.id}`)}>{d.applications}</Link>
        </p>
      </PageHeader>

      <Section id="in-force" title={d.inForce} className="border-t border-rule">
        <div className="max-w-[62ch] space-y-2">
          <p className="font-medium" lang="en">
            {ldp.adopted.title}
          </p>
          <p className="text-ink-2">
            {(ldp.adopted.periodStart
              ? ldp.adopted.adoptedDate
                ? d.adoptedOn.replace("{date}", formatDate(locale, ldp.adopted.adoptedDate))
                : d.adoptedPeriod
              : ldp.adopted.adoptedDate
                ? d.adoptedOnTo.replace("{date}", formatDate(locale, ldp.adopted.adoptedDate))
                : d.adoptedTo
            )
              .replace("{from}", String(ldp.adopted.periodStart))
              .replace("{to}", String(ldp.adopted.periodEnd))}
          </p>
          {periodEnded(ldp, today) ? <p className="text-ink-2">{d.expiredNote.replace("{year}", String(ldp.adopted.periodEnd))}</p> : null}
          {ldp.noteEn ? <p className="text-ink-2">{locale === "cy" && ldp.noteCy ? ldp.noteCy : ldp.noteEn}</p> : null}
          <ul className="space-y-1 text-small">
            <li>
              <a href={ldp.adopted.pageUrl ?? undefined} rel="noopener">
                {d.planPage}
              </a>
            </li>
            {ldp.adopted.writtenStatement.map((u, i) => (
              <li key={u}>
                <a href={u} rel="noopener">
                  {ldp.adopted.writtenStatement.length > 1 ? d.statementPart.replace("{n}", String(i + 1)) : d.statement}
                </a>
              </li>
            ))}
            {ldp.adopted.writtenStatementCy.map((u) => (
              <li key={u}>
                <a href={u} rel="noopener" hrefLang="cy">
                  {d.statementCy}
                </a>
              </li>
            ))}
            {ldp.adopted.mapUrl ? (
              <li>
                <a href={ldp.adopted.mapUrl} rel="noopener">
                  {d.map}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </Section>

      <Says locale={locale} id={a.id} points={detail.points} sp={sp} />

      <Section id="figures" title={d.figures} className="mt-8 border-t border-rule">
        <p className="mb-4 max-w-[62ch] text-small text-ink-2">{d.figuresLede}</p>
        {PLAN_FACTS.some((k) => factFor("adopted", k) || factFor("deposit", k)) ? (
          <div className="overflow-x-auto">
            <table className="data-table max-w-[48rem]">
              <thead>
                <tr>
                  <th scope="col">{d.figure}</th>
                  <th scope="col">{d.adoptedCol}</th>
                  {hasDeposit ? <th scope="col">{d.depositCol}</th> : null}
                </tr>
              </thead>
              <tbody>
                {PLAN_FACTS.filter((k) => factFor("adopted", k) || factFor("deposit", k)).map((k) => {
                  const now = factFor("adopted", k);
                  const next = factFor("deposit", k);
                  return (
                    <tr key={k}>
                      <th scope="row" className="text-left font-medium">
                        {t.facts[k]}
                      </th>
                      <td>{now ? <FactValue locale={locale} f={now} /> : <span className="text-ink-3">–</span>}</td>
                      {hasDeposit ? <td>{next ? <FactValue locale={locale} f={next} /> : <span className="text-ink-3">–</span>}</td> : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-ink-2">{d.figuresNone}</p>
        )}
      </Section>

      <Section id="monitoring" title={d.monitoring} className="mt-8 border-t border-rule">
        {ldp.amr.year ? <p className="mb-2 text-small text-ink-2">{d.monitoringLede.replace("{year}", ldp.amr.year)}</p> : null}
        <p className="mb-4 max-w-[62ch] text-small text-ink-2">{t.amrWhat}</p>
        {AMR_FACTS.some((k) => factFor("amr", k)) ? (
          <ul className="rows max-w-[48rem]">
            {AMR_FACTS.map((k) => {
              const f = factFor("amr", k);
              return f ? (
                <li key={k} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{t.facts[k]}</span>
                  <span>
                    <FactValue locale={locale} f={f} />
                  </span>
                </li>
              ) : null;
            })}
          </ul>
        ) : (
          <p className="text-ink-2">{d.monitoringNone}</p>
        )}
        {ldp.amr.url ? (
          <p className="mt-3 text-small">
            <a href={ldp.amr.url} rel="noopener">
              {d.amrLink}
            </a>
          </p>
        ) : null}
      </Section>

      <Replacement locale={locale} ldp={ldp} />

      <Sites locale={locale} id={a.id} sites={detail.sites} hasDeposit={hasDeposit} sp={sp} />

      {onSites ? (
        <Section id="on-sites" title={d.onSites} className="mt-8 border-t border-rule">
          <p className="mb-3 max-w-[62ch] text-small text-ink-2">{d.onSitesLede.replace("{name}", name)}</p>
          {onSites.length ? (
            <ul className="rows">
              {onSites.map((x) => (
                <li key={`${x.id}-${x.siteRef}`} className="py-2">
                  <Link href={href(locale, `/planning/application/${x.id}`)} className="font-medium" lang="en">
                    {x.address || x.reference}
                  </Link>
                  {x.description ? (
                    <span className="block text-small text-ink-2" lang="en">
                      {x.description}
                    </span>
                  ) : null}
                  <span className="block text-meta text-ink-2">
                    {d.siteLabel}: <span lang="en">{[x.siteName, x.siteRef].filter(Boolean).join(", ") || d.uses[x.use as (typeof USES)[number]]}</span>
                  </span>
                  {x.startDate ? <span className="block text-meta text-ink-2">{`${d.received} ${formatDate(locale, x.startDate)}`}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-2">{d.onSitesNone}</p>
          )}
        </Section>
      ) : null}

      {council ? (
        <Section id="meetings" title={d.meetings} className="mt-8 border-t border-rule">
          <p className="mb-3 text-small text-ink-2">{d.meetingsLede}</p>
          {meetings.length ? (
            <ul className="rows">
              {meetings.map((m) => (
                <li key={m.meetingId} className="py-2">
                  <Link href={href(locale, `/${council.id}/meetings/${m.meetingId}`)} className="font-medium">
                    {(locale === "cy" && m.committeeCy) || m.committeeEn}
                  </Link>{" "}
                  <span className="text-small text-ink-2">{formatDate(locale, m.date)}</span>
                  <span className="block text-small text-ink-2" lang="en">
                    {m.itemTitle}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-2">{d.meetingsNone}</p>
          )}
        </Section>
      ) : null}

      <Section id="sources" title={d.sources} className="mt-8 border-t border-rule">
        <div className="max-w-[62ch] space-y-2 text-small text-ink-2">
          {problems.length ? <p>{d.problems.replace("{list}", problems.map((p) => p.url.split("/").pop()).join(", "))}</p> : null}
          <p>{d.checked.replace("{date}", formatDate(locale, ldp.checked))}</p>
          <ul className="space-y-1">
            {[...new Set([ldp.adopted.source, ldp.replacement.source, ldp.amr.source].flatMap((s) => (s ?? "").split(/\s+/)).filter((s) => s.startsWith("http")))].map((s) => (
              <li key={s} className="break-all">
                <a href={s} rel="noopener">
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </>
  );
}

function Replacement({ locale, ldp }: { locale: Locale; ldp: LdpRecord }) {
  const t = plansMessages[locale];
  const d = t.detail;
  const r = ldp.replacement;
  const current = STAGE_ORDER.indexOf(r.stage);
  const step = nextStepText(locale, ldp, t);
  return (
    <Section id="replacement" title={d.replacement} className="mt-8 border-t border-rule">
      {replacementUnderWay(ldp) ? (
        <div className="max-w-[62ch] space-y-3">
          {r.title ? (
            <p className="font-medium" lang="en">
              {r.title}
            </p>
          ) : null}
          {r.periodStart && r.periodEnd ? <p className="text-ink-2">{d.replacementPeriod.replace("{from}", String(r.periodStart)).replace("{to}", String(r.periodEnd))}</p> : null}
          <div>
            <h3 className="text-small font-semibold">{d.stageNow}</h3>
            <p>
              {t.stages[r.stage]}
              {r.stageDate ? <span className="text-ink-2"> {d.stageDate.replace("{date}", planDate(locale, r.stageDate))}</span> : null}
            </p>
            <p className="text-small text-ink-2">{t.stageHelp[r.stage]}</p>
          </div>
          {r.slipped ? <p className="text-small text-ink-2">{t.slipped}</p> : null}
          {step ? (
            <div>
              <h3 className="text-small font-semibold">{d.nextStep}</h3>
              <p>{step}</p>
            </div>
          ) : null}
          {current >= 0 ? (
            <div>
              <h3 className="text-small font-semibold">{d.timeline}</h3>
              <ol className="mt-1 space-y-1 text-small">
                {STAGE_ORDER.map((s, i) => (
                  <li key={s} className={i === current ? "font-semibold" : i < current ? "text-ink-2" : "text-ink-3"} aria-current={i === current ? "step" : undefined}>
                    {i + 1}. {t.stages[s]}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <ul className="space-y-1 text-small">
            {r.pageUrl ? (
              <li>
                <a href={r.pageUrl} rel="noopener">
                  {d.replacementPage}
                </a>
              </li>
            ) : null}
            {r.deposit.map((u) => (
              <li key={u}>
                <a href={u} rel="noopener">
                  {d.depositLink}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-ink-2">{t.stageHelp.none}</p>
      )}
    </Section>
  );
}

function Sites({ locale, id, sites, hasDeposit, sp }: { locale: Locale; id: string; sites: LdpSite[]; hasDeposit: boolean; sp: SearchParams }) {
  const t = plansMessages[locale];
  const d = t.detail;
  const plan: LdpKind = hasDeposit && oneOf(sp, "plan", ["deposit"] as const) ? "deposit" : "adopted";
  const use = oneOf(sp, "use", USES);
  const link = (o: Record<string, string | undefined>) =>
    href(locale, `/planning/plans/${id}`) + queryString({ plan: plan === "deposit" ? "deposit" : undefined, use, ...o }) + "#sites";
  const inPlan = sites.filter((s) => s.kind === plan);
  const shown = inPlan.filter((s) => !use || s.use === use);
  const usesPresent = USES.filter((u) => inPlan.some((s) => s.use === u));
  return (
    <Section id="sites" title={d.sites} className="mt-8 border-t border-rule">
      <p className="mb-4 max-w-[62ch] text-small text-ink-2">{plan === "deposit" ? d.sitesDeposit : d.sitesLede}</p>
      {hasDeposit ? (
        <nav aria-label={d.planChoice} className="mb-3 flex flex-wrap gap-2">
          <Link href={link({ plan: undefined, use: undefined })} className="chip" aria-current={plan === "adopted" ? "page" : undefined} scroll={false}>
            {d.adoptedCol}
          </Link>
          <Link href={link({ plan: "deposit", use: undefined })} className="chip" aria-current={plan === "deposit" ? "page" : undefined} scroll={false}>
            {d.depositCol}
          </Link>
        </nav>
      ) : null}
      {inPlan.length ? (
        <>
          {usesPresent.length > 1 ? (
            <nav aria-label={t.filters} className="mb-3 flex flex-wrap gap-2">
              <Link href={link({ use: undefined })} className="chip" aria-current={!use ? "page" : undefined} scroll={false}>
                {d.uses.all}
              </Link>
              {usesPresent.map((u) => (
                <Link key={u} href={link({ use: u })} className="chip" aria-current={use === u ? "page" : undefined} scroll={false}>
                  {d.uses[u]}
                </Link>
              ))}
            </nav>
          ) : null}
          <p className="mb-2 text-small text-ink-2">{d.sitesCount.replace("{n}", formatNumber(locale, shown.length))}</p>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{d.siteCols.ref}</th>
                  <th scope="col">{d.siteCols.name}</th>
                  <th scope="col">{d.siteCols.settlement}</th>
                  <th scope="col">{d.siteCols.use}</th>
                  <th scope="col" className="text-right">
                    {d.siteCols.homes}
                  </th>
                  <th scope="col" className="text-right">
                    {d.siteCols.hectares}
                  </th>
                  <th scope="col">{d.siteCols.source}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s, i) => (
                  <tr key={`${s.ref}-${s.name}-${i}`}>
                    <td className="text-small num whitespace-nowrap">{s.ref ?? ""}</td>
                    <th scope="row" className="text-left font-medium" lang="en">
                      {s.name}
                    </th>
                    <td className="text-small" lang="en">
                      {s.settlement ?? ""}
                    </td>
                    <td className="text-small">{d.uses[s.use as (typeof USES)[number]] ?? s.use}</td>
                    <td className="text-right num">{s.homes !== null ? formatNumber(locale, s.homes) : ""}</td>
                    <td className="text-right num">{s.hectares !== null ? formatNumber(locale, s.hectares, 1) : ""}</td>
                    <td className="text-small whitespace-nowrap">
                      <a href={`${s.url}#page=${s.page}`} rel="noopener">
                        {d.page.replace("{n}", String(s.page))}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-ink-2">{d.sitesNone}</p>
      )}
    </Section>
  );
}

const TOPICS = ["strategy", "housing", "economy", "town-centres", "environment", "climate", "transport", "welsh-language"] as const;

function Says({ locale, id, points, sp }: { locale: Locale; id: string; points: LdpPoint[]; sp: SearchParams }) {
  const t = plansMessages[locale];
  const d = t.detail;
  const hasDeposit = points.some((p) => p.kind === "deposit");
  const hasAdopted = points.some((p) => p.kind === "adopted");
  const plan: LdpKind = hasDeposit && (!hasAdopted || oneOf(sp, "says", ["deposit"] as const)) ? "deposit" : "adopted";
  const shown = points.filter((p) => p.kind === plan);
  const link = (k: string | undefined) => href(locale, `/planning/plans/${id}`) + queryString({ ...sp, says: k }) + "#says";
  return (
    <Section id="says" title={d.says} className="mt-8 border-t border-rule">
      <p className="mb-4 max-w-[62ch] text-small text-ink-2">{plan === "deposit" ? d.saysDeposit : d.saysLede}</p>
      {hasDeposit && hasAdopted ? (
        <nav aria-label={d.planChoice} className="mb-4 flex flex-wrap gap-2">
          <Link href={link(undefined)} className="chip" aria-current={plan === "adopted" ? "page" : undefined} scroll={false}>
            {d.adoptedCol}
          </Link>
          <Link href={link("deposit")} className="chip" aria-current={plan === "deposit" ? "page" : undefined} scroll={false}>
            {d.depositCol}
          </Link>
        </nav>
      ) : null}
      {shown.length ? (
        <div className="max-w-[62ch] space-y-6">
          {TOPICS.filter((topic) => shown.some((p) => p.topic === topic)).map((topic) => (
            <div key={topic}>
              <h3 className="font-semibold">{d.topics[topic]}</h3>
              <ul className="prose-read mt-2 list-disc space-y-2 pl-5">
                {shown
                  .filter((p) => p.topic === topic)
                  .map((p, i) => (
                    <li key={`${p.url}-${i}`}>
                      {locale === "cy" ? p.textCy : p.textEn}{" "}
                      <a href={`${p.url}#page=${p.page}`} rel="noopener" className="whitespace-nowrap text-meta text-ink-2">
                        {p.policy ? d.policyPage.replace("{policy}", p.policy).replace("{page}", String(p.page)) : d.pageOnly.replace("{page}", String(p.page))}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-ink-2">{d.saysNone}</p>
      )}
    </Section>
  );
}
