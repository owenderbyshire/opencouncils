import type { Metadata } from "next";
import { committeeName } from "@/lib/committees";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Section } from "@/components/page-header";
import { ApplicationItem, isOpen, Stages, StateBadge, stateLabel } from "@/components/planning";
import { isDecided } from "@/lib/planning-status";
import { BlockSkeleton } from "@/components/skeleton";
import { applicationsNear, getApplication, someApplicationIds, type ApplicationDetail } from "@/data/planning";
import { planningAuthority } from "@data/curated/planning-authorities";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { planningMessages } from "@/i18n/messages/planning";
import { plansMessages } from "@/i18n/messages/plans";
import { allocatedSitesFor } from "@/data/ldp";
import { pickText } from "@/i18n/pick";
import { getLocale } from "@/i18n/server";
import { isId } from "@/lib/route";
import { pageMetadata } from "@/lib/metadata";
import { atLeastOne } from "@/lib/params";

/*
 * One planning application: where it has got to, what it is, how to comment
 * while it's open, and, when it went to a planning committee, what the
 * committee decided, from the meeting's papers.
 */

type Params = Promise<{ id: string }>;

export async function generateStaticParams() {
  return atLeastOne((await someApplicationIds()).map((id) => ({ id: String(id) })), { id: "0" });
}

async function load(params: Params): Promise<ApplicationDetail | null> {
  const { id } = await params;
  return isId(id) ? getApplication(Number(id)) : null;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/planning/application/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const a = await load(params);
  if (!a) return { title: common[locale].notFound.title };
  return pageMetadata({
    locale,
    path: `/planning/application/${a.id}`,
    title: a.address || a.reference || String(a.id),
    description: (a.description ?? "").slice(0, 160),
  });
}

export default async function ApplicationPage({ params }: PageProps<"/[lang]/planning/application/[id]">) {
  const locale = await getLocale();
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={12} label={common[locale].words.loading} />}>
        <Body locale={locale} params={params} />
      </Suspense>
    </div>
  );
}

function stageOf(a: ApplicationDetail): 0 | 1 | 2 | 3 {
  if (!isOpen(a.status)) return 3;
  if (a.consultedDate) return 2;
  return 1;
}

async function Body({ locale, params }: { locale: Locale; params: Params }) {
  const a = await load(params);
  if (!a) notFound();
  const t = planningMessages[locale];
  const auth = planningAuthority(a.authority);
  const authName = auth ? (locale === "cy" ? auth.nameCy : auth.nameEn) : a.authority;
  const en = locale === "cy" ? "en" : undefined;
  const open = isOpen(a.status);
  const facts: Array<[string, React.ReactNode]> = [
    [t.app.status, <StateBadge key="s" t={t} status={a.status} state={a.appState} />],
    [t.app.reference, <span key="r" className="num">{a.reference}</span>],
    [t.app.type, a.appType ? (t.types[a.appType] ?? a.appType) : null],
    [t.app.size, a.appSize ? (t.sizes[a.appSize] ?? a.appSize) : null],
    [t.app.homes, a.homes ? formatNumber(locale, a.homes) : null],
    [t.app.ward, a.ward ? <span lang={en}>{a.ward}</span> : null],
    [t.app.receivedLabel, a.startDate ? formatDate(locale, a.startDate) : null],
    [t.app.consulted, a.consultedDate ? formatDate(locale, a.consultedDate) : null],
    [t.app.target, open && a.targetDate ? formatDate(locale, a.targetDate) : null],
    [t.app.decidedLabel, a.decidedDate ? formatDate(locale, a.decidedDate) : null],
    [t.app.decision, a.decision && a.decision !== a.appState ? <span lang={en}>{a.decision}</span> : null],
  ];
  const allocated = await allocatedSitesFor(a.name);
  const near = a.lat !== null && a.lng !== null ? (await applicationsNear(a.lat, a.lng, { km: 0.5 })).filter((x) => x.id !== a.id).slice(0, 6) : [];
  const committee = committeeName(locale, a.committeeEn, a.committeeCy);
  const decided = pickText(locale, a.decidedEn, a.decidedCy);
  return (
    <>
      <PageHeader
        kicker={
          <Link href={href(locale, auth?.councilId ? `/${auth.councilId}/planning` : `/planning/${a.authority}`)} className="link-quiet">
            {authName}
          </Link>
        }
        title={<span lang={en}>{a.address || a.reference}</span>}
        lede={a.description ? <span lang={en}>{a.description}</span> : undefined}
      />
      <div className="grid gap-x-14 border-t border-rule pt-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <dl className="grid max-w-[40rem] grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-small">
          {facts
            .filter(([, v]) => v !== null && v !== undefined && v !== "")
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-2">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
        <aside className="mt-6 space-y-2 text-small lg:mt-0">
          {a.lat !== null && a.lng !== null ? (
            <p>
              <a href={`https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=17/${a.lat}/${a.lng}`} rel="noopener">
                {t.app.map}
              </a>
            </p>
          ) : null}
          {a.docsUrl || a.url ? (
            <p>
              <a href={a.docsUrl ?? a.url!} rel="noopener">
                {t.app.documents}
              </a>
            </p>
          ) : null}
          {a.url ? (
            <p>
              <a href={a.url} rel="noopener">
                {t.app.official}
              </a>
            </p>
          ) : null}
        </aside>
      </div>

      {allocated.length ? (
        <p className="mt-6 max-w-[62ch] border-l-2 border-rule pl-4 text-small">
          {plansMessages[locale].onAllocated
            .replace("{use}", plansMessages[locale].onAllocatedUse[allocated[0].use as "housing"] ?? plansMessages[locale].onAllocatedUse.other)
            .replace(": {site}", allocated.some((x) => x.name || x.ref) ? `: ${allocated.map((x) => [x.name, x.ref].filter(Boolean).join(", ")).filter(Boolean).join("; ")}` : "")}{" "}
          <Link href={href(locale, `/planning/plans/${allocated[0].authority}#sites`)}>{plansMessages[locale].aboutPlan}</Link>
        </p>
      ) : null}
      <Section id="say" title={t.app.sayTitle} className="mt-8 border-t border-rule">
        {a.dns ? <p className="mb-3 max-w-[62ch]">{t.app.dns}</p> : null}
        {open ? (
          <div className="max-w-[62ch] space-y-3">
            <p>{t.app.sayOpen}</p>
            <p className="text-small text-ink-2">{t.whatCounts}</p>
            {a.commentUrl || a.url ? (
              <p>
                <a href={a.commentUrl ?? a.url!} rel="noopener" className="button">
                  {t.app.sayLink}
                </a>
              </p>
            ) : null}
          </div>
        ) : isDecided(a.status) ? (
          <p className="max-w-[62ch] text-ink-2">
            {t.app.sayClosed} {stateLabel(t, a.status, a.appState)}
            {a.decidedDate ? `, ${formatDate(locale, a.decidedDate)}` : ""}.
          </p>
        ) : (
          <p className="max-w-[62ch] text-ink-2">
            {a.status === "withdrawn" ? t.app.sayWithdrawn : a.status === "referred" ? t.app.sayReferred : t.app.sayUnknown}
          </p>
        )}
      </Section>

      {a.meetingId && a.councilId && a.meetingDate ? (
        <Section id="committee" title={t.app.committeeTitle} className="border-t border-rule">
          <p className="max-w-[62ch]">
            {t.app.committeeBody.replace("{committee}", committee.text).replace("{date}", formatDate(locale, a.meetingDate))}
          </p>
          {decided.text || a.minuteDecision ? (
            <div className="mt-4 max-w-[62ch] border-l-2 border-accent pl-4">
              <p className="text-small font-semibold">{t.app.committeeDecided}</p>
              <p lang={decided.text ? decided.lang : en} className="whitespace-pre-line">
                {decided.text || a.minuteDecision}
              </p>
            </div>
          ) : null}
          <p className="mt-4 text-small">
            <Link href={href(locale, `/${a.councilId}/meetings/${a.meetingId}#item-${a.agendaItemId}`)}>{t.app.committeeItem}</Link>
          </p>
        </Section>
      ) : null}

      <Section id="stages" title={t.app.stagesTitle} className="border-t border-rule">
        <Stages locale={locale} current={stageOf(a)} />
      </Section>

      {near.length ? (
        <Section id="nearby" title={t.app.nearbyTitle} className="border-t border-rule">
          <ul className="rows">
            {near.map((x) => (
              <ApplicationItem
                key={x.id}
                locale={locale}
                a={x}
                extra={<span className="text-small text-ink-2 num">{formatNumber(locale, x.metres)} m</span>}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      <p className="mt-10 max-w-[62ch] text-meta text-ink-2">{t.app.source.replace("{authority}", authName)}</p>
    </>
  );
}
