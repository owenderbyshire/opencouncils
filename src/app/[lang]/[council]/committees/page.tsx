import type { Metadata } from "next";
import { committeeName } from "@/lib/committees";
import { KindGuideLink } from "@/components/take-part";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, Section } from "@/components/page-header";
import { BlockSkeleton, ListSkeleton } from "@/components/skeleton";
import { listCommittees } from "@/data/council";
import type { CommitteeKind } from "@/db/schema";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { councilMessages } from "@/i18n/messages/council";
import { getLocale } from "@/i18n/server";
import { councilName, liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { councilFrom } from "@/lib/route";

const ORDER: CommitteeKind[] = ["council", "cabinet", "scrutiny", "planning", "regulatory", "other"];
type Params = Promise<{ council: string }>;

export async function generateMetadata({ params }: PageProps<"/[lang]/[council]/committees">): Promise<Metadata> {
  const locale = await getLocale();
  const c = liveCouncil((await params).council);
  if (!c) return { title: common[locale].notFound.title };
  const t = councilMessages[locale].committees;
  const name = councilName(locale, c);
  return pageMetadata({ locale, path: `/${c.id}/committees`, title: `${t.title}: ${name}`, description: t.lede.replace("{name}", name) });
}

export default async function CommitteesPage({ params }: PageProps<"/[lang]/[council]/committees">) {
  const locale = await getLocale();
  const loading = common[locale].words.loading;
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={2} label={loading} />}>
        <Header locale={locale} params={params} />
      </Suspense>
      <Suspense fallback={<ListSkeleton label={loading} />}>
        <Groups locale={locale} params={params} />
      </Suspense>
    </div>
  );
}

async function Header({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  const t = councilMessages[locale].committees;
  return <PageHeader title={t.title} lede={t.lede.replace("{name}", councilName(locale, c))} />;
}

async function Groups({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  const t = councilMessages[locale];
  const all = await listCommittees(c.id);
  return (
    <>
      {ORDER.map((kind) => {
        const list = all.filter((x) => x.kind === kind);
        if (!list.length) return null;
        return (
          <Section key={kind} id={kind} title={t.kinds[kind]} className="border-t border-rule">
            <p className="-mt-1 mb-4 max-w-[62ch] text-small text-ink-2">
              {t.kindNotes[kind]} <KindGuideLink locale={locale} kind={kind} />
            </p>
            <ul className="rows">
              {list.map((x) => {
                const name = committeeName(locale, x.nameEn, x.nameCy);
                return (
                  <li key={x.id} className="grid gap-x-6 py-3 sm:grid-cols-[1fr_auto]">
                    <Link href={href(locale, `/${c.id}/committees/${x.id}`)} lang={name.lang}>
                      {name.text}
                    </Link>
                    <span className="text-small text-ink-2">
                      {x.members ? t.committees.members.replace("{n}", formatNumber(locale, x.members)) : ""}
                      {x.members && (x.nextMeeting || x.lastMeeting) ? ", " : ""}
                      {x.nextMeeting ? (
                        <time dateTime={x.nextMeeting}>{formatDate(locale, x.nextMeeting, "short")}</time>
                      ) : x.lastMeeting ? (
                        <time dateTime={x.lastMeeting}>{formatDate(locale, x.lastMeeting, "short")}</time>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>
        );
      })}
    </>
  );
}
