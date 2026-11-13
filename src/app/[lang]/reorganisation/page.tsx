import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/page-header";
import { href } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { ukMessages } from "@/i18n/messages/uk";
import { getLocale } from "@/i18n/server";
import { pageMetadata } from "@/lib/metadata";
import { REORG_CHANGES, councilPath, registerEntry } from "@/lib/register";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = ukMessages[locale].reorg;
  return pageMetadata({ locale, path: "/reorganisation", title: t.title, description: t.lede });
}

export default async function ReorganisationPage() {
  const locale = await getLocale();
  const t = ukMessages[locale].reorg;
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede} />
      <p className="max-w-[62ch] rounded border border-rule bg-surface p-4 text-small text-ink-2">{t.review}</p>
      {REORG_CHANGES.map((change) => (
        <Section key={change.id} title={`${change.area}: ${t.status[change.status]}`}>
          <p className="text-small text-ink-2">
            {t.starts.replace("{date}", formatDate(locale, change.vestingDate))}{" "}
            {change.shadowElection ? t.shadow.replace("{date}", formatDate(locale, change.shadowElection)) : null}
          </p>
          {/* Old councils on the left, the new one on the right: who becomes what. */}
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {change.new.map((n) => (
              <li key={n.id} className="rounded border border-rule p-4">
                <h3 className="font-sans text-body font-semibold">
                  <span className="mr-2 inline-block size-3 rounded-sm bg-accent align-middle" aria-hidden="true" />
                  <Link href={href(locale, councilPath(n.id))}>{n.name}</Link>
                </h3>
                <p className="mt-2 text-meta font-semibold text-ink-3">{t.replaces}</p>
                <ul className="mt-1 text-small">
                  {n.replaces.map((old) => (
                    <li key={old}>
                      <Link href={href(locale, councilPath(old))}>{registerEntry(old)?.name ?? old}</Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-meta text-ink-3">
            {t.sources}:{" "}
            {change.sources.map((s, i) => (
              <span key={s}>
                {i ? ", " : ""}
                <a href={s} rel="noopener">
                  {new URL(s).hostname}
                </a>
              </span>
            ))}
          </p>
        </Section>
      ))}
    </div>
  );
}
