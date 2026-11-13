import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeleton";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { ukMessages } from "@/i18n/messages/uk";
import { Rich } from "@/i18n/rich";
import { getLocale } from "@/i18n/server";
import { liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { oneOf, type SearchParams } from "@/lib/params";
import { KINDS, NATION_SLUGS, NATIONS, councilPath, councilsIn, nationSlug, type CouncilKind } from "@/lib/register";

const REGISTER_SOURCE = "https://github.com/mysociety/uk_local_authority_names_and_codes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = ukMessages[locale].index;
  return pageMetadata({ locale, path: "/councils", title: t.title, description: t.lede });
}

export default async function CouncilsPage({ searchParams }: PageProps<"/[lang]/councils">) {
  const locale = await getLocale();
  const t = ukMessages[locale].index;
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede} />
      <Suspense fallback={<ListSkeleton label={common[locale].words.loading} />}>
        <List locale={locale} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
      <p className="mt-8 max-w-[62ch] text-meta text-ink-3">
        <Rich text={t.source} links={{ source: REGISTER_SOURCE }} />
      </p>
    </div>
  );
}

async function List({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const t = ukMessages[locale];
  const sp = await searchParams;
  const nationKey = oneOf(sp, "nation", Object.keys(NATION_SLUGS));
  const nation = nationKey ? NATION_SLUGS[nationKey] : undefined;
  const kind = oneOf(sp, "type", KINDS) as CouncilKind | undefined;
  const rows = councilsIn(nation, kind);
  const link = (next: { nation?: string; type?: string }) => {
    const q = new URLSearchParams();
    const n = "nation" in next ? next.nation : nationKey;
    const k = "type" in next ? next.type : kind;
    if (n) q.set("nation", n);
    if (k) q.set("type", k);
    const s = q.toString();
    return href(locale, `/councils${s ? `?${s}` : ""}`);
  };
  const kindsHere = KINDS.filter((k) => councilsIn(nation, k).length);
  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-small font-semibold">{t.index.nation}</span>
          <Link href={link({ nation: undefined })} className="chip" aria-current={!nation ? "page" : undefined} scroll={false}>
            {t.index.all}
          </Link>
          {NATIONS.map((n) => (
            <Link key={n} href={link({ nation: nationSlug(n), type: undefined })} className="chip" aria-current={nation === n ? "page" : undefined} scroll={false}>
              {n}
            </Link>
          ))}
        </div>
        {kindsHere.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-small font-semibold">{t.index.kind}</span>
            <Link href={link({ type: undefined })} className="chip" aria-current={!kind ? "page" : undefined} scroll={false}>
              {t.index.all}
            </Link>
            {kindsHere.map((k) => (
              <Link key={k} href={link({ type: k })} className="chip" aria-current={kind === k ? "page" : undefined} scroll={false}>
                {t.kinds[k]}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      {kind ? <p className="mt-4 max-w-[62ch] text-small text-ink-2">{t.kindExplain[kind]}</p> : null}
      <p className="mt-4 text-small text-ink-2">{t.index.count.replace("{n}", formatNumber(locale, rows.length))}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th scope="col">{t.index.colCouncil}</th>
              <th scope="col">{t.index.colType}</th>
              {!nation ? <th scope="col">{t.index.colNation}</th> : null}
              <th scope="col" className="text-right">
                {t.index.colPopulation}
              </th>
              <th scope="col">{t.index.colRecords}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <th scope="row" className="font-normal">
                  <Link href={href(locale, councilPath(c.id))}>{c.short}</Link>
                  {c.endDate ? <span className="block text-meta text-ink-3">{t.index.ending.replace("{date}", formatDate(locale, c.endDate))}</span> : null}
                </th>
                <td className="text-ink-2">{c.typeName}</td>
                {!nation ? <td className="text-ink-2">{c.nation}</td> : null}
                <td className="text-right tabular-nums">{formatNumber(locale, c.population)}</td>
                <td className="text-ink-2">{liveCouncil(c.id) ? t.index.full : t.index.registerOnly}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
