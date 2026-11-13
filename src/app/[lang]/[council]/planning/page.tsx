import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ApplicationList, Stages } from "@/components/planning";
import { PlanningDecisions } from "@/components/planning-decisions";
import { BlockSkeleton } from "@/components/skeleton";
import { planningAuthority } from "@data/curated/planning-authorities";
import { href, type Locale } from "@/i18n/config";
import { common } from "@/i18n/messages/common";
import { planningMessages } from "@/i18n/messages/planning";
import { plansMessages } from "@/i18n/messages/plans";
import { ldpFor } from "@data/curated/ldps";
import { getLocale } from "@/i18n/server";
import { councilName, liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { oneOf, pageParam, type SearchParams } from "@/lib/params";
import { councilFrom } from "@/lib/route";

/* A council's planning applications, from UK PlanIt via pipeline/jobs/planning.ts. */

export async function generateMetadata({ params }: PageProps<"/[lang]/[council]/planning">): Promise<Metadata> {
  const locale = await getLocale();
  const c = liveCouncil((await params).council);
  if (!c) return { title: common[locale].notFound.title };
  const t = planningMessages[locale];
  const name = councilName(locale, c);
  return pageMetadata({ locale, path: `/${c.id}/planning`, title: t.listTitle.replace("{name}", name), description: t.listLede.replace("{name}", name) });
}

export default async function CouncilPlanningPage({ params, searchParams }: PageProps<"/[lang]/[council]/planning">) {
  const locale = await getLocale();
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={10} label={common[locale].words.loading} />}>
        <Body locale={locale} params={params} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </div>
  );
}

async function Body({ locale, params, searchParams }: { locale: Locale; params: Promise<{ council: string }>; searchParams: Promise<SearchParams> }) {
  const c = await councilFrom(params);
  const a = planningAuthority(c.id);
  const sp = await searchParams;
  const t = planningMessages[locale];
  const name = councilName(locale, c);
  return (
    <>
      <PageHeader title={t.listTitle.replace("{name}", name)} lede={t.listLede.replace("{name}", name)}>
        <p className="flex flex-wrap gap-x-6 gap-y-1 text-small">
          {a ? (
            <a href={a.portal} rel="noopener">
              {t.registerLink}
            </a>
          ) : null}
          <a href={href(locale, "/planning")}>{t.title}</a>
          {ldpFor(c.id) ? <a href={href(locale, `/planning/plans/${c.id}`)}>{plansMessages[locale].link}</a> : null}
        </p>
      </PageHeader>
      <div className="border-t border-rule pt-6">
        {a ? <PlanningDecisions locale={locale} authority={c.id} /> : null}
        <ApplicationList
          locale={locale}
          authority={c.id}
          path={`/${c.id}/planning`}
          filter={oneOf(sp, "show", ["open", "decided", "committee"] as const)}
          page={pageParam(sp)}
        />
      </div>
      <section aria-labelledby="how" className="mt-12 border-t border-rule pt-8">
        <h2 id="how" className="text-h3">
          {t.howTitle}
        </h2>
        <div className="mt-4">
          <Stages locale={locale} />
        </div>
        <p className="mt-4 max-w-[62ch] text-small text-ink-2">{t.whatCounts}</p>
      </section>
    </>
  );
}
