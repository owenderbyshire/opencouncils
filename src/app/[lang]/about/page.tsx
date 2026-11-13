import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Section } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeleton";
import { pipelineStatus } from "@/data/council";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { aboutMessages } from "@/i18n/messages/about";
import { common } from "@/i18n/messages/common";
import { Rich } from "@/i18n/rich";
import { getLocale } from "@/i18n/server";
import { pageMetadata } from "@/lib/metadata";
import { SITE } from "@/lib/site";
import { DAILY_SEQUENCE } from "../../../../pipeline/sequences";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = aboutMessages[locale];
  return pageMetadata({ locale, path: "/about", title: t.title, description: t.lede });
}

export default async function AboutPage() {
  const locale = await getLocale();
  const t = aboutMessages[locale];
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede} />
      {t.sections.map((s, i) => (
        <Section key={i} id={`s${i}`} title={s.title} className="border-t border-rule">
          <div className="prose-read">
            {s.body.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
          </div>
        </Section>
      ))}
      <Section id="status" title={t.statusTitle} className="border-t border-rule">
        <p className="-mt-1 mb-4 text-small text-ink-2">{t.statusLede}</p>
        <Suspense fallback={<ListSkeleton rows={4} label={common[locale].words.loading} />}>
          <Status locale={locale} />
        </Suspense>
      </Section>
      <Section id="contact" title={t.contactTitle} className="border-t border-rule">
        <p className="prose-read">
          <Rich text={t.contactBody} values={{ email: SITE.contactEmail }} links={{ email: `mailto:${SITE.contactEmail}` }} />
        </p>
      </Section>
    </div>
  );
}

async function Status({ locale }: { locale: Locale }) {
  const t = aboutMessages[locale];
  const runs = await pipelineStatus();
  if (!runs.length) return <p className="text-ink-2">{t.neverRun}</p>;
  const byJob = new Map(runs.map((r) => [r.job, r]));
  return (
    <table className="data-table max-w-[40rem]">
      <thead>
        <tr>
          <th scope="col">{t.job}</th>
          <th scope="col">{t.lastRun}</th>
          <th scope="col">{t.result}</th>
        </tr>
      </thead>
      <tbody>
        {DAILY_SEQUENCE.map((job) => {
          const r = byJob.get(job);
          return (
            <tr key={job}>
              <td>{job}</td>
              <td>{r?.finishedAt ? formatDate(locale, r.finishedAt, "short") : ""}</td>
              <td>{r ? (t.results[r.status as keyof typeof t.results] ?? r.status) : ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
