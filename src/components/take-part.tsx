import Link from "next/link";
import { href, type Locale } from "@/i18n/config";
import { engageMessages } from "@/i18n/messages/engage";
import { Rich } from "@/i18n/rich";

/**
 * What someone can do about a meeting. Before the minutes are out the advice
 * is about the meeting itself (attend, speak, ask a question); afterwards it
 * is about what happens next (call-in, correcting the minutes, following up).
 */
export function TakePart({
  locale,
  kind,
  settled,
  official,
}: {
  locale: Locale;
  kind: string;
  settled: boolean;
  official: string | null;
}) {
  const t = engageMessages[locale];
  const before = [
    t.upcoming.watch,
    kind === "planning" ? t.upcoming.speakPlanning : null,
    kind === "council" ? t.upcoming.question : null,
    t.upcoming.tellCouncillor,
  ];
  const after = [kind === "cabinet" ? t.past.callIn : null, t.past.minutes, t.past.followUp];
  const lines = (settled ? after : before).filter((x): x is string => Boolean(x));
  return (
    <div className="grid gap-x-12 gap-y-6 md:grid-cols-[minmax(0,1fr)_16rem]">
      <ul className="max-w-[62ch] space-y-3">
        {lines.map((line) => (
          <li key={line} className="border-l-2 border-accent pl-4">
            <Rich text={line} links={{ callin: href(locale, "/guide#term-call-in") }} />
          </li>
        ))}
      </ul>
      <ul className="space-y-2 text-small">
        <li>
          <Link href={href(locale, "/find")} className="font-semibold">
            {t.findCouncillors}
          </Link>
        </li>
        {official ? (
          <li>
            <a href={official}>{t.officialPage}</a>
          </li>
        ) : null}
        <li>
          <Link href={href(locale, "/guide#have-your-say")}>{t.howCouncilsWork}</Link>
        </li>
      </ul>
    </div>
  );
}

/** Links to mySociety and Democracy Club services, filled with a postcode when there is one. */
export function OtherServices({ locale, postcode }: { locale: Locale; postcode?: string }) {
  const t = engageMessages[locale];
  const pc = postcode ? encodeURIComponent(postcode) : "";
  const links = [
    { key: "writetothem", url: pc ? `https://www.writetothem.com/?pc=${pc}` : "https://www.writetothem.com/" },
    { key: "fixmystreet", url: pc ? `https://www.fixmystreet.com/around?pc=${pc}` : "https://www.fixmystreet.com/" },
    {
      key: "whocanivotefor",
      url: postcode ? `https://whocanivotefor.co.uk/elections/${postcode.replace(/\s+/g, "")}/` : "https://whocanivotefor.co.uk/",
    },
  ] as const;
  return (
    <section aria-labelledby="services" className="mt-10 border-t border-rule pt-6">
      <h2 id="services" className="text-h3">
        {t.servicesTitle}
      </h2>
      <p className="mt-1 max-w-[62ch] text-small text-ink-2">{t.servicesLede}</p>
      <ul className="rows mt-4 max-w-[48rem]">
        {links.map((l) => (
          <li key={l.key} className="grid gap-x-6 py-3 sm:grid-cols-[12rem_1fr]">
            <a href={l.url} rel="noopener" className="font-semibold" lang="en">
              {t.services[l.key].name}
            </a>
            <span className="text-small text-ink-2">{t.services[l.key].note}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-meta text-ink-2">{t.servicesBy}</p>
    </section>
  );
}

const KIND_GUIDE: Record<string, string> = {
  council: "#term-full-council",
  cabinet: "#term-cabinet",
  scrutiny: "#term-scrutiny",
  planning: "#who",
  regulatory: "#who",
  other: "#who",
};

/** A short link from a committee type to where the guide explains it. */
export function KindGuideLink({ locale, kind }: { locale: Locale; kind: string }) {
  return (
    <Link href={href(locale, `/guide${KIND_GUIDE[kind] ?? ""}`)} className="whitespace-nowrap">
      {engageMessages[locale].guideLink}
    </Link>
  );
}
