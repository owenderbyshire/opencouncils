import Link from "next/link";
import { ISSUES } from "@data/curated/compare-decisions";
import { href, type Locale } from "@/i18n/config";
import { compareDecisionMessages } from "@/i18n/messages/compare-decisions";

/** Links to the issue tables (one decision, every council), optionally only those filed under a topic. */
export function CompareLinks({ locale, topic, label }: { locale: Locale; topic?: string; label?: string }) {
  const m = compareDecisionMessages[locale];
  const list = ISSUES.filter((i) => !topic || i.topic === topic);
  if (!list.length) return null;
  return (
    <p className="text-small">
      <span className="text-ink-2">{label ?? m.indexTitle}: </span>
      {list.map((i, n) => (
        <span key={i.slug}>
          {n ? ", " : ""}
          <Link href={href(locale, `/compare/${i.slug}`)}>{m.issues[i.slug].short}</Link>
        </span>
      ))}
    </p>
  );
}
