import Link from "next/link";
import { Section } from "@/components/page-header";
import { councilBrief } from "@/data/briefs";
import { href, type Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { councilBriefMessages } from "@/i18n/messages/briefs";
import { COUNCIL_BRIEF_SECTIONS } from "@/lib/council-brief";
import type { BriefPoint } from "@/lib/topic-brief";

/**
 * A web source's title as the page gave it, or its address when the page gave
 * nothing readable (one council PDF's title is just "0").
 */
function sourceTitle(s: { title: string; url: string | null }): string {
  const title = s.title.trim();
  if (/\p{L}{3}/u.test(title) || !s.url) return title;
  try {
    const u = new URL(s.url);
    const file = decodeURIComponent(u.pathname.split("/").filter(Boolean).at(-1) ?? "");
    return file ? `${u.hostname}: ${file}` : u.hostname;
  } catch {
    return title;
  }
}

/** The council's monthly overview (pipeline/jobs/council-briefs.ts): nothing until one has been written. */
export async function CouncilBrief({ locale, councilId }: { locale: Locale; councilId: string }) {
  const b = await councilBrief(councilId);
  if (!b) return null;
  const t = councilBriefMessages[locale];
  const c = b.content;
  const sources = new Map(c.sources.map((s, i) => [s.id, { ...s, n: i + 1 }]));
  const cite = (ids: string[]) =>
    ids
      .map((id) => sources.get(id))
      .filter((s) => s !== undefined)
      .map((s) => (
        <a key={s.id} href={`#council-source-${s.n}`} className="ml-1 text-meta text-ink-2 no-underline" aria-label={`${t.sources} ${s.n}`}>
          [{s.n}]
        </a>
      ));
  const text = (p: BriefPoint) => (locale === "cy" ? p.cy : p.en);
  return (
    <Section id="overview" title={t.title} className="border-t border-rule">
      <div className="max-w-[62ch]">
        {c.summary ? (
          <p className="text-read">
            {text(c.summary)}
            {cite(c.summary.sources)}
          </p>
        ) : null}
        {COUNCIL_BRIEF_SECTIONS.filter((k) => c[k].length).map((k) => (
          <div key={k} className="mt-5">
            <h3 className="font-semibold">{t.sections[k]}</h3>
            <ul className="prose-read mt-2 list-disc space-y-2 pl-5">
              {c[k].map((p, i) => (
                <li key={i}>
                  {text(p)}
                  {cite(p.sources)}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="mt-5 text-small text-ink-2">
          {t.written.replace("{month}", formatDate(locale, `${b.month}-01`, "month")).replace("{from}", formatDate(locale, c.recordsFrom))} {t.how}
        </p>
        <details className="mt-3 text-small">
          <summary className="cursor-pointer text-ink-2">{t.sources}</summary>
          <ol className="mt-2 space-y-1">
            {[...sources.values()].map((s) => (
              <li key={s.id} id={`council-source-${s.n}`}>
                {s.n}.{" "}
                {(s.kind === "record" || s.kind === "upcoming") && s.meetingId ? (
                  <>
                    <Link href={href(locale, `/${councilId}/meetings/${s.meetingId}`)}>{(s.kind === "record" ? t.meeting : t.agenda).replace("{date}", s.date ? formatDate(locale, s.date) : "")}</Link>
                    <span className="text-ink-2" lang="en">
                      {" "}
                      {s.title}
                    </span>
                  </>
                ) : s.kind === "fact" ? (
                  s.url ? (
                    <a href={s.url} rel="noopener">
                      {t.fact}
                    </a>
                  ) : (
                    t.fact
                  )
                ) : s.url ? (
                  <a href={s.url} rel="noopener">
                    {s.kind === "consultation" ? `${t.consultation}: ` : ""}
                    <span lang="en">{sourceTitle(s)}</span>
                  </a>
                ) : (
                  <span lang="en">{sourceTitle(s)}</span>
                )}
              </li>
            ))}
          </ol>
        </details>
      </div>
    </Section>
  );
}
