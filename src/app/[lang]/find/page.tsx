import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CouncillorsArt } from "@/components/illustrations";
import { PageHeader } from "@/components/page-header";
import { PostcodeForm } from "@/components/postcode-form";
import { OtherServices } from "@/components/take-part";
import { engageMessages } from "@/i18n/messages/engage";
import { Rich } from "@/i18n/rich";
import { BlockSkeleton } from "@/components/skeleton";
import { getWard, listCouncillors } from "@/data/council";
import { lookupPostcode, normalisePostcode } from "@/data/postcode";
import { href, type Locale } from "@/i18n/config";
import { common } from "@/i18n/messages/common";
import { walesMessages } from "@/i18n/messages/wales";
import { pickText } from "@/i18n/pick";
import { getLocale } from "@/i18n/server";
import { councilConfig, councilName, liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { ynPlace } from "@/i18n/welsh";
import { param, type SearchParams } from "@/lib/params";
import { partyColour, partyName } from "@/lib/parties";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = walesMessages[locale].find;
  return pageMetadata({ locale, path: "/find", title: t.title, description: t.lede });
}

export default async function FindPage({ searchParams }: PageProps<"/[lang]/find">) {
  const locale = await getLocale();
  const t = walesMessages[locale].find;
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede} kicker={<CouncillorsArt size={48} className="text-ink" />} />
      <Suspense fallback={<BlockSkeleton lines={6} label={common[locale].words.loading} />}>
        <Result locale={locale} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </div>
  );
}

async function Result({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const t = walesMessages[locale].find;
  const raw = param(await searchParams, "postcode") ?? "";
  const form = (
    <div className="border-t border-rule pt-6">
      <PostcodeForm locale={locale} value={raw} />
    </div>
  );
  if (!raw) return form;
  const postcode = normalisePostcode(raw);
  if (!postcode)
    return (
      <>
        {form}
        <p className="mt-4 text-ink-2" role="status">
          {t.notFound}
        </p>
      </>
    );
  const r = await lookupPostcode(postcode);
  if (!r.ok)
    return (
      <>
        {form}
        <p className="mt-4 text-ink-2" role="status">
          {r.reason === "notWales" ? t.notWales : r.reason === "unavailable" ? t.unavailable : t.notFound}
        </p>
      </>
    );

  const config = councilConfig(r.councilId)!;
  const live = liveCouncil(r.councilId);
  const council = councilName(locale, config);
  if (!live)
    return (
      <>
        {form}
        <p className="mt-4" role="status">
          {t.notCovered.replace("{council}", council)}
        </p>
      </>
    );

  const ward = r.wardSlug ? await getWard(r.councilId, r.wardSlug) : null;
  if (ward && ward.councillors.length) {
    const wardName = pickText(locale, ward.nameEn, ward.nameCy).text;
    return (
      <>
        {form}
        <section className="mt-8" aria-labelledby="yours">
          <p className="text-read" role="status">
            {t.councilLine.replace("{postcode}", postcode).replace("{ward}", wardName).replace("{council}", council)}
          </p>
          <h2 id="yours" className="mt-6 text-h3">
            {t.yourCouncillors}
          </h2>
          <ul className="rows mt-3 max-w-[40rem]">
            {ward.councillors.map((p) => (
              <li key={p.id} className="flex items-start gap-3 py-4">
                <span aria-hidden="true" className="mt-2 inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: partyColour(p.partyId, p.partyLabel) }} />
                <span>
                  <Link href={href(locale, `/${r.councilId}/councillors/${p.id}`)} className="text-h4 font-semibold">
                    {p.name}
                  </Link>
                  <span className="block text-small text-ink-2">{partyName(locale, p.partyId, p.partyLabel)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-6">
            <Link href={`${href(locale, `/${r.councilId}/area`)}${r.lsoa ? `?n=${r.lsoa}` : ""}`} className="font-semibold">
              {t.yourArea}
            </Link>
          </p>
          <p className="mt-6">
            <Rich text={engageMessages[locale].election} />
          </p>
          <p className="mt-6 text-meta text-ink-2">{t.source}</p>
        </section>
        <OtherServices locale={locale} postcode={postcode} />
      </>
    );
  }

  // No single ward matched: show every ward in the council.
  const all = await listCouncillors(r.councilId);
  const wards = new Map<string, string>();
  for (const p of all) if (p.current && p.wardSlug) wards.set(p.wardSlug, pickText(locale, p.wardEn, p.wardCy).text);
  if (!wards.size)
    return (
      <>
        {form}
        <p className="mt-8 max-w-[62ch]" role="status">
          {t.councillorsNotLoaded.replace("{postcode}", postcode).replace("{inCouncil}", locale === "cy" ? ynPlace(council) : `in ${council}`).replace("{ward}", r.onsWard ?? "")}
        </p>
      </>
    );
  return (
    <>
      {form}
      <section className="mt-8" aria-labelledby="wards">
        <p className="max-w-[62ch]" role="status">
          {t.wardUnmatched.replace("{postcode}", postcode).replace("{inCouncil}", locale === "cy" ? ynPlace(council) : `in ${council}`).replace("{ward}", r.onsWard ?? "")}
        </p>
        <h2 id="wards" className="mt-6 text-h3">
          {t.allWards}
        </h2>
        <ul className="mt-3 grid gap-x-8 gap-y-1 text-small sm:grid-cols-2 lg:grid-cols-3">
          {[...wards].sort((a, b) => a[1].localeCompare(b[1])).map(([slug, name]) => (
            <li key={slug}>
              <Link href={href(locale, `/${r.councilId}/wards/${slug}`)}>{name}</Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-meta text-ink-2">{t.source}</p>
      </section>
      <OtherServices locale={locale} postcode={postcode} />
    </>
  );
}
