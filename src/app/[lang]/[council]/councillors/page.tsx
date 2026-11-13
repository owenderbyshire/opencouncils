import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, Section } from "@/components/page-header";
import { BlockSkeleton } from "@/components/skeleton";
import { listCouncillors, type CouncillorRow } from "@/data/council";
import { href, type Locale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { councilMessages } from "@/i18n/messages/council";
import { pickText } from "@/i18n/pick";
import { getLocale } from "@/i18n/server";
import { councilName, liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { partyColour, partyName } from "@/lib/parties";
import { councilFrom } from "@/lib/route";

type Params = Promise<{ council: string }>;

export async function generateMetadata({ params }: PageProps<"/[lang]/[council]/councillors">): Promise<Metadata> {
  const locale = await getLocale();
  const c = liveCouncil((await params).council);
  if (!c) return { title: common[locale].notFound.title };
  const t = councilMessages[locale].councillors;
  const name = councilName(locale, c);
  return pageMetadata({ locale, path: `/${c.id}/councillors`, title: `${t.title}: ${name}` });
}

export default async function CouncillorsPage({ params }: PageProps<"/[lang]/[council]/councillors">) {
  const locale = await getLocale();
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={2} label={common[locale].words.loading} />}>
        <Body locale={locale} params={params} />
      </Suspense>
    </div>
  );
}

async function Body({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  const t = councilMessages[locale].councillors;
  const all = await listCouncillors(c.id);
  const current = all.filter((p) => p.current);
  const former = all.filter((p) => !p.current);
  const wards = new Map<string, { name: { text: string; lang?: Locale }; people: CouncillorRow[] }>();
  for (const p of current) {
    const key = p.wardSlug ?? "";
    const w = wards.get(key) ?? { name: key ? pickText(locale, p.wardEn, p.wardCy) : { text: t.noWard }, people: [] };
    w.people.push(p);
    wards.set(key, w);
  }
  return (
    <>
      <PageHeader
        title={t.title}
        lede={t.lede.replace("{count}", formatNumber(locale, current.length)).replace("{name}", councilName(locale, c))}
      />
      <Section id="wards" title={t.byWard} className="border-t border-rule">
        {current.length ? (
          <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...wards].map(([slug, w]) => (
              <div key={slug}>
                <h3 className="font-sans text-small font-semibold">
                  {slug ? (
                    <Link href={href(locale, `/${c.id}/wards/${slug}`)} lang={w.name.lang}>
                      {w.name.text}
                    </Link>
                  ) : (
                    w.name.text
                  )}
                </h3>
                <People locale={locale} councilId={c.id} people={w.people} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-2">{common[locale].words.noResults}</p>
        )}
      </Section>
      {former.length ? (
        <Section id="former" title={t.former} className="border-t border-rule">
          <People locale={locale} councilId={c.id} people={former} columns />
        </Section>
      ) : null}
    </>
  );
}

function People({ locale, councilId, people, columns = false }: { locale: Locale; councilId: string; people: CouncillorRow[]; columns?: boolean }) {
  return (
    <ul className={`mt-1 space-y-1 text-small ${columns ? "grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3" : ""}`}>
      {people.map((p) => (
        <li key={p.id} className="flex items-start gap-2">
          <span aria-hidden="true" className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: partyColour(p.partyId, p.partyLabel) }} />
          <span>
            <Link href={href(locale, `/${councilId}/councillors/${p.id}`)}>{p.name}</Link>
            <span className="text-ink-2">, {partyName(locale, p.partyId, p.partyLabel)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
