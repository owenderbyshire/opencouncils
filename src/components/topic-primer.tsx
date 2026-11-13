import Link from "next/link";
import { periodLabel, showValue } from "@/components/measure-format";
import { getCouncilData, type ServiceGroup } from "@/data/council-data";
import { performanceMeasures } from "@/data/performance";
import { href, type Locale } from "@/i18n/config";
import { formatMoney } from "@/i18n/format";
import { performanceMessages } from "@/i18n/messages/performance";
import { planningMessages } from "@/i18n/messages/planning";
import { topicGuide } from "@/i18n/messages/topic-guide";
import { Rich } from "@/i18n/rich";
import { COUNCILS, councilShort } from "@/lib/councils";

/** Which budget line and which performance themes each topic draws on. */
const SPEND: Record<string, ServiceGroup> = {
  housing: "housing",
  schools: "education",
  "social-care": "social-services",
  transport: "roads",
  waste: "environment",
  economy: "planning",
  "leisure-culture": "culture",
  planning: "planning",
  "council-running": "administration",
};
const THEMES: Record<string, string[]> = {
  housing: ["housing", "homes"],
  schools: ["schools"],
  "social-care": ["social-care", "children"],
  transport: ["roads"],
  planning: ["planning"],
  budget: ["money"],
  "council-running": ["democracy", "money"],
};

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

/** The top of a topic page: what councils do about it, who decides, how to have a say, and the numbers. */
export async function TopicPrimer({ locale, slug }: { locale: Locale; slug: string }) {
  const g = topicGuide[locale];
  const p = g.primers[slug];
  if (!p) return null;
  const [money, measures] = await Promise.all([getCouncilData(), performanceMeasures()]);
  const lines: string[] = [];
  const group = SPEND[slug];
  if (money && group) {
    const wales = money.wales.spend?.groups.find((x) => x.key === group)?.perHead ?? null;
    const year = money.wales.spend?.year ?? "";
    const per = COUNCILS.flatMap((c) => {
      const v = money.councils[c.id]?.spend?.groups.find((x) => x.key === group)?.perHead;
      return v != null ? [{ c, v }] : [];
    }).sort((a, b) => a.v - b.v);
    if (wales !== null) lines.push(fill(g.spendLine, { wales: formatMoney(locale, wales, 0), year }));
    if (per.length > 1)
      lines.push(
        fill(g.spendRange, {
          low: formatMoney(locale, per[0].v, 0),
          lowName: councilShort(locale, per[0].c),
          high: formatMoney(locale, per[per.length - 1].v, 0),
          highName: councilShort(locale, per[per.length - 1].c),
        }),
      );
  }
  const pt = performanceMessages[locale];
  const related = measures.filter((m) => THEMES[slug]?.includes(m.theme) && m.wales !== null);
  for (const m of related.slice(0, 4)) {
    const name = pt.measures[m.key]?.name;
    if (name) lines.push(fill(g.measureLine, { name, value: showValue(locale, m.unit, m.wales!, m.per, m.perOf), period: m.period ? periodLabel(locale, m.period) : "" }).replace(" ()", ""));
  }
  return (
    <section aria-label={g.whatTitle} className="border-t border-rule py-8">
      <div className="grid gap-8 md:grid-cols-3">
        {(
          [
            [g.whatTitle, p.what],
            [g.whoTitle, p.who],
            [g.sayTitle, p.say],
          ] as const
        ).map(([title, body]) => (
          <div key={title}>
            <h2 className="text-h4">{title}</h2>
            <p className="mt-2 text-small leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
      {lines.length ? (
        <div className="mt-8 rounded border border-rule bg-surface p-5">
          <h2 className="text-h4">{g.numbersTitle}</h2>
          <ul className="mt-2 space-y-1.5 text-small">
            {lines.map((l) => (
              <li key={l}>
                <Rich text={l} />
              </li>
            ))}
          </ul>
          <p className="mt-3 flex flex-wrap gap-x-6 text-small">
            <Link href={href(locale, "/performance")}>{g.moreMeasures}</Link>
            {slug === "planning" ? <Link href={href(locale, "/planning/league")}>{planningMessages[locale].league.title}</Link> : null}
          </p>
        </div>
      ) : null}
    </section>
  );
}
