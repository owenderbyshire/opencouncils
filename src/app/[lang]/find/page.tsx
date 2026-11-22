import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CouncillorsArt } from "@/components/illustrations";
import { PageHeader } from "@/components/page-header";
import { PostcodeForm } from "@/components/postcode-form";
import { OtherServices } from "@/components/take-part";
import { BlockSkeleton } from "@/components/skeleton";
import { getWard } from "@/data/council";
import { lookupPostcodeUk, normalisePostcode, type PostcodeCouncil } from "@/data/postcode";
import { href, type Locale } from "@/i18n/config";
import { common } from "@/i18n/messages/common";
import { ukMessages } from "@/i18n/messages/uk";
import { pickText } from "@/i18n/pick";
import { getLocale } from "@/i18n/server";
import { liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { param, type SearchParams } from "@/lib/params";
import { partyColour, partyName } from "@/lib/parties";
import { councilPath, registerEntry } from "@/lib/register";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = ukMessages[locale].find;
  return pageMetadata({ locale, path: "/find", title: t.title, description: t.lede });
}

export default async function FindPage({ searchParams }: PageProps<"/[lang]/find">) {
  const locale = await getLocale();
  const t = ukMessages[locale].find;
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
  const t = ukMessages[locale].find;
  const raw = param(await searchParams, "postcode") ?? "";
  const form = (
    <div className="border-t border-rule pt-6">
      <PostcodeForm locale={locale} value={raw} placeholder={t.placeholder} />
    </div>
  );
  if (!raw) return form;
  const postcode = normalisePostcode(raw);
  const status = (text: string) => (
    <>
      {form}
      <p className="mt-4 text-ink-2" role="status">
        {text}
      </p>
    </>
  );
  if (!postcode) return status(t.notFound);
  const r = await lookupPostcodeUk(postcode);
  if (!r.ok) return status(r.reason === "unavailable" ? t.unavailable : r.reason === "noCouncil" ? t.noCouncil : t.notFound);

  return (
    <>
      {form}
      <div className="mt-8 max-w-[48rem]" role="status">
        {r.councils.length > 1 && <p className="mb-6 text-read">{t.twoTier.replace("{postcode}", postcode)}</p>}
        {r.councils.map((c) => (
          <CouncilBlock key={c.councilId} locale={locale} postcode={postcode} c={c} />
        ))}
        <p className="mt-6 text-meta text-ink-2">{t.source}</p>
      </div>
      <OtherServices locale={locale} postcode={postcode} />
    </>
  );
}

async function CouncilBlock({ locale, postcode, c }: { locale: Locale; postcode: string; c: PostcodeCouncil }) {
  const t = ukMessages[locale].find;
  const entry = registerEntry(c.councilId);
  const council = entry?.name ?? c.councilId;
  const live = liveCouncil(c.councilId);
  const ward = live && c.wardSlug ? await getWard(c.councilId, c.wardSlug) : null;
  const wardName = ward ? pickText(locale, ward.nameEn, ward.nameCy).text : null;
  return (
    <section className="border-t border-rule py-6" aria-label={council}>
      <p className="text-read">
        {wardName
          ? t.inWard.replace("{postcode}", postcode).replace("{ward}", wardName).replace("{council}", council)
          : t.inCouncil.replace("{postcode}", postcode).replace("{council}", council)}
      </p>
      {ward && ward.councillors.length > 0 ? (
        <>
          <h2 className="mt-5 text-h4">{t.yourCouncillors.replace("{council}", council)}</h2>
          <ul className="rows mt-2">
            {ward.councillors.map((p) => (
              <li key={p.id} className="flex items-start gap-3 py-3">
                <span aria-hidden="true" className="mt-2 inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: partyColour(p.partyId, p.partyLabel) }} />
                <span>
                  <Link href={href(locale, `/${c.councilId}/councillors/${p.id}`)} className="font-semibold">
                    {p.name}
                  </Link>
                  <span className="block text-small text-ink-2">{partyName(locale, p.partyId, p.partyLabel)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : live ? (
        <p className="mt-3 text-ink-2">
          {c.onsWard ? `${t.wardUnmatched.replace("{ward}", c.onsWard)} ` : ""}
          <Link href={href(locale, `/${c.councilId}/councillors`)}>{t.yourCouncillors.replace("{council}", council)}</Link>
        </p>
      ) : (
        <p className="mt-3 text-ink-2">{t.notLive.replace("{council}", council)}</p>
      )}
      <p className="mt-3">
        <Link href={href(locale, councilPath(c.councilId))} className="font-semibold">
          {t.councilPage.replace("{council}", council)}
        </Link>
      </p>
    </section>
  );
}
