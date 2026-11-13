import type { Metadata } from "next";
import { AgendaStep, CouncillorsArt, DecisionArt, ExplainedStep, MeetingStep, SearchArt } from "@/components/illustrations";
import { PageHeader } from "@/components/page-header";
import { PostcodeForm } from "@/components/postcode-form";
import { guideMessages } from "@/i18n/messages/guide";
import { getLocale } from "@/i18n/server";
import { pageMetadata } from "@/lib/metadata";

const ART = {
  what: SearchArt,
  who: CouncillorsArt,
  scrutiny: DecisionArt,
  meetings: MeetingStep,
  interests: AgendaStep,
  "have-your-say": ExplainedStep,
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = guideMessages[locale];
  return pageMetadata({ locale, path: "/guide", title: t.title, description: t.lede });
}

export default async function GuidePage() {
  const locale = await getLocale();
  const t = guideMessages[locale];
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede} />
      <div className="grid gap-x-14 border-t border-rule lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-labelledby="contents" className="py-8 lg:sticky lg:top-4 lg:self-start">
          <h2 id="contents" className="font-sans text-small font-semibold">
            {t.contents}
          </h2>
          <ol className="mt-2 space-y-1.5 text-small">
            {t.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="link-quiet">
                  {s.title}
                </a>
              </li>
            ))}
            <li>
              <a href="#glossary" className="link-quiet">
                {t.glossaryTitle}
              </a>
            </li>
          </ol>
        </nav>
        <div className="min-w-0">
          {t.sections.map((s, i) => {
            const Art = ART[s.id as keyof typeof ART];
            return (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className={`py-8 ${i ? "border-t border-rule" : ""}`}>
                <div className="flex items-center gap-4">
                  {Art ? <Art size={48} className="shrink-0 text-ink" /> : null}
                  <h2 id={`${s.id}-title`} className="text-h3">
                    {s.title}
                  </h2>
                </div>
                <div className="prose-read mt-4">
                  {s.paras.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                </div>
                {s.id === "have-your-say" ? (
                  <div className="mt-6 rounded border border-rule bg-surface p-5">
                    <PostcodeForm locale={locale} />
                  </div>
                ) : null}
              </section>
            );
          })}
          <section id="glossary" aria-labelledby="glossary-title" className="border-t border-rule py-8">
            <h2 id="glossary-title" className="text-h3">
              {t.glossaryTitle}
            </h2>
            <p className="mt-1 text-ink-2">{t.glossaryLede}</p>
            <dl className="mt-6 grid gap-x-10 gap-y-5 md:grid-cols-2">
              {t.glossary.map((g) => (
                <div key={g.id} id={`term-${g.id}`} className="scroll-mt-6 border-t border-rule pt-3 target:bg-surface">
                  <dt className="font-semibold">{g.term}</dt>
                  <dd className="mt-1 text-small text-ink-2">{g.def}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
