import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { BlockSkeleton } from "@/components/skeleton";
import { getWard, someWardSlugs } from "@/data/council";
import { href, type Locale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { councilMessages } from "@/i18n/messages/council";
import { pickText } from "@/i18n/pick";
import { getLocale } from "@/i18n/server";
import { softMutate } from "@/i18n/welsh";
import { councilName, liveCouncil, LIVE_COUNCILS } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { atLeastOne } from "@/lib/params";
import { partyColour, partyName } from "@/lib/parties";
import { councilFrom } from "@/lib/route";

type Params = Promise<{ council: string; slug: string }>;

const isSlug = (s: string) => /^[a-z0-9-]{1,80}$/.test(s);

export async function generateStaticParams() {
  const out = [];
  for (const c of LIVE_COUNCILS) for (const slug of await someWardSlugs(c.id, 3)) out.push({ council: c.id, slug });
  return atLeastOne(out, { council: LIVE_COUNCILS[0]?.id ?? "cardiff", slug: "placeholder" });
}

export async function generateMetadata({ params }: PageProps<"/[lang]/[council]/wards/[slug]">): Promise<Metadata> {
  const locale = await getLocale();
  const { council, slug } = await params;
  const c = liveCouncil(council);
  const w = c && isSlug(slug) ? await getWard(c.id, slug) : null;
  if (!c || !w) return { title: common[locale].notFound.title };
  const ward = pickText(locale, w.nameEn, w.nameCy).text;
  return pageMetadata({
    locale,
    path: `/${c.id}/wards/${w.slug}`,
    title: `${councilMessages[locale].ward.title.replace("{ward}", ward)}, ${councilName(locale, c)}`,
  });
}

export default async function WardPage({ params }: PageProps<"/[lang]/[council]/wards/[slug]">) {
  const locale = await getLocale();
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={6} label={common[locale].words.loading} />}>
        <Ward locale={locale} params={params} />
      </Suspense>
    </div>
  );
}

async function Ward({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  const { slug } = await params;
  if (!isSlug(slug)) notFound();
  const w = await getWard(c.id, slug);
  if (!w) notFound();
  const t = councilMessages[locale].ward;
  const ward = pickText(locale, w.nameEn, w.nameCy);
  // "ar Gyngor Caerdydd": the council's name takes a soft mutation after "ar".
  const council = locale === "cy" ? softMutate(councilName(locale, c)) : councilName(locale, c);
  return (
    <>
      <PageHeader
        title={<span lang={ward.lang}>{t.title.replace("{ward}", ward.text)}</span>}
        lede={t.lede.replace("{ward}", ward.text).replace("{name}", council)}
      >
        {w.seats ? <p className="text-small text-ink-2">{t.seats.replace("{n}", formatNumber(locale, w.seats))}</p> : null}
      </PageHeader>
      <ul className="rows max-w-[48rem] border-t border-rule">
        {w.councillors.map((p) => (
          <li key={p.id} className="flex items-start gap-3 py-4">
            <span aria-hidden="true" className="mt-2 inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: partyColour(p.partyId, p.partyLabel) }} />
            <span>
              <Link href={href(locale, `/${c.id}/councillors/${p.id}`)} className="font-semibold">
                {p.name}
              </Link>
              <span className="block text-small text-ink-2">{partyName(locale, p.partyId, p.partyLabel)}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
