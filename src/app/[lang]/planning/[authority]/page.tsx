import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ApplicationList } from "@/components/planning";
import { BlockSkeleton } from "@/components/skeleton";
import { PLANNING_AUTHORITIES, planningAuthority } from "@data/curated/planning-authorities";
import { href, type Locale } from "@/i18n/config";
import { common } from "@/i18n/messages/common";
import { planningMessages } from "@/i18n/messages/planning";
import { plansMessages } from "@/i18n/messages/plans";
import { ldpFor } from "@data/curated/ldps";
import { getLocale } from "@/i18n/server";
import { liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { oneOf, pageParam, type SearchParams } from "@/lib/params";

/* A national park's planning applications. Councils' are on the council's own Planning tab. */

export function generateStaticParams() {
  return PLANNING_AUTHORITIES.filter((a) => a.kind === "national-park").map((a) => ({ authority: a.id }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/planning/[authority]">): Promise<Metadata> {
  const locale = await getLocale();
  const a = planningAuthority((await params).authority);
  if (!a) return { title: common[locale].notFound.title };
  const t = planningMessages[locale];
  const name = locale === "cy" ? a.nameCy : a.nameEn;
  return pageMetadata({ locale, path: `/planning/${a.id}`, title: t.listTitle.replace("{name}", name), description: t.listLede.replace("{name}", name) });
}

export default async function AuthorityPage({ params, searchParams }: PageProps<"/[lang]/planning/[authority]">) {
  const locale = await getLocale();
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={10} label={common[locale].words.loading} />}>
        <Body locale={locale} params={params} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </div>
  );
}

async function Body({ locale, params, searchParams }: { locale: Locale; params: Promise<{ authority: string }>; searchParams: Promise<SearchParams> }) {
  const a = planningAuthority((await params).authority);
  if (!a) notFound();
  if (a.councilId && liveCouncil(a.councilId)) redirect(href(locale, `/${a.councilId}/planning`));
  const sp = await searchParams;
  const t = planningMessages[locale];
  const name = locale === "cy" ? a.nameCy : a.nameEn;
  return (
    <>
      <PageHeader title={t.listTitle.replace("{name}", name)} lede={t.listLede.replace("{name}", name)}>
        <p className="text-small">
          <a href={a.portal} rel="noopener">
            {t.registerLink}
          </a>
          {ldpFor(a.id) ? (
            <>
              {" "}
              <a href={href(locale, `/planning/plans/${a.id}`)} className="ml-4">
                {plansMessages[locale].link}
              </a>
            </>
          ) : null}
        </p>
      </PageHeader>
      <div className="border-t border-rule pt-6">
        <ApplicationList
          locale={locale}
          authority={a.id}
          path={`/planning/${a.id}`}
          filter={oneOf(sp, "show", ["open", "decided", "committee"] as const)}
          page={pageParam(sp)}
        />
      </div>
    </>
  );
}
