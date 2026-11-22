import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Section } from "@/components/page-header";
import { ClimateAndFoi, PartyBalance } from "@/components/outside";
import { BlockSkeleton } from "@/components/skeleton";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { ukMessages } from "@/i18n/messages/uk";
import { getLocale } from "@/i18n/server";
import { liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { atLeastOne } from "@/lib/params";
import { REGISTER, councilPath, registerEntry, type RegisterEntry } from "@/lib/register";
import platforms from "@data/curated/platforms.json";

const PLATFORMS = platforms.councils as Record<string, { website: string | null; base: string | null } | undefined>;

/** Register pages for councils without full pages, current and past. */
function shown(c: RegisterEntry | undefined): c is RegisterEntry {
  return Boolean(c && c.kind !== "combined");
}

export async function generateStaticParams() {
  return atLeastOne(
    REGISTER.filter((c) => shown(c) && (c.current || c.shadow) && !liveCouncil(c.id)).slice(0, 20).map((c) => ({ id: c.id })),
    { id: "woking" },
  );
}

export async function generateMetadata({ params }: PageProps<"/[lang]/councils/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const c = registerEntry(id);
  if (!shown(c)) return {};
  const t = ukMessages[locale].council;
  return pageMetadata({ locale, path: `/councils/${id}`, title: c.name, description: t.registerLede.replace("{type}", c.typeName).replace("{nation}", c.nation) });
}

export default async function RegisterPage({ params }: PageProps<"/[lang]/councils/[id]">) {
  const locale = await getLocale();
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton label={common[locale].words.loading} />}>
        <Body locale={locale} params={params} />
      </Suspense>
    </div>
  );
}

async function Body({ locale, params }: { locale: Locale; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = registerEntry(id);
  if (!shown(c)) notFound();
  // Councils with full pages live at /<id>.
  if (liveCouncil(id)) redirect(href(locale, `/${id}`));
  const t = ukMessages[locale].council;
  const p = PLATFORMS[id];
  const name = (cid: string) => registerEntry(cid)?.short ?? cid;
  const links = (ids: string[]) =>
    ids.map((x, i) => (
      <span key={x}>
        {i ? ", " : ""}
        <Link href={href(locale, councilPath(x))}>{name(x)}</Link>
      </span>
    ));
  const facts: Array<[string, React.ReactNode]> = [
    [t.gss, c.gss ?? "–"],
    ...(c.population ? [[t.population, formatNumber(locale, c.population)] as [string, React.ReactNode]] : []),
    ...(c.county ? [[t.county, links([c.county])] as [string, React.ReactNode]] : []),
    ...(c.combinedAuthority ? [[t.combined, name(c.combinedAuthority)] as [string, React.ReactNode]] : []),
    ...(c.startDate ? [[t.since, formatDate(locale, c.startDate)] as [string, React.ReactNode]] : []),
    ...(c.endDate ? [[t.ends, formatDate(locale, c.endDate)] as [string, React.ReactNode]] : []),
    ...(c.replacedBy.length ? [[t.replacedBy, links(c.replacedBy)] as [string, React.ReactNode]] : []),
    ...(c.replaces?.length ? [[t.replaces, links(c.replaces)] as [string, React.ReactNode]] : []),
    ...(p?.website ? [[t.website, <a key="w" href={p.website} rel="noopener">{new URL(p.website).hostname}</a>] as [string, React.ReactNode]] : []),
    ...(p?.base ? [[t.records, <a key="r" href={p.base} rel="noopener">{new URL(p.base).hostname}</a>] as [string, React.ReactNode]] : []),
  ];
  return (
    <>
      <PageHeader title={c.name} lede={t.registerLede.replace("{type}", c.typeName).replace("{nation}", c.nation)} />
      <p className="max-w-[62ch] text-body text-ink-2">{t.notYet}</p>
      <Section title={t.facts}>
        <dl className="grid max-w-[44rem] gap-x-8 gap-y-2 text-small sm:grid-cols-[14rem_1fr]">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-2">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
      {c.current && (
        <>
          <PartyBalance locale={locale} councilId={id} name={c.name} />
          <ClimateAndFoi locale={locale} councilId={id} name={c.name} />
        </>
      )}
    </>
  );
}
