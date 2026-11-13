import Link from "next/link";
import { Section } from "@/components/page-header";
import { allCabinets, councilCabinet, type CabinetMember, type CommitteeChair, type CouncilCabinet } from "@/data/cabinets";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";
import { cabinetMessages } from "@/i18n/messages/cabinets";
import { isExecutivePost, saysDeputyLeader, saysLeader } from "@/lib/cabinet";
import { committeeName } from "@/lib/committees";
import { councilConfig, councilShort } from "@/lib/councils";
import { partyColour, partyName } from "@/lib/parties";

/*
 * Who holds what: the pieces shared by the all-Wales page, a council's
 * overview and the topic pages. Portfolios are the council's own words,
 * usually English, so they carry lang="en" on Welsh pages.
 */

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

/** A party's colour as a data mark beside a name. The party is always written out as well. */
export function PartyDot({ partyId, partyLabel }: { partyId: string | null; partyLabel: string | null }) {
  return <span aria-hidden="true" className="mt-[0.45rem] inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: partyColour(partyId, partyLabel) }} />;
}

/** A councillor's name, linked to their page, with their party beneath. */
export function Holder({ locale, councilId, p }: { locale: Locale; councilId: string; p: { councillorId: number; name: string; partyId: string | null; partyLabel: string | null } }) {
  return (
    <span className="flex items-start gap-2">
      <PartyDot partyId={p.partyId} partyLabel={p.partyLabel} />
      <span>
        <Link href={href(locale, `/${councilId}/councillors/${p.councillorId}`)} className="font-semibold">
          {p.name}
        </Link>
        <span className="block text-small text-ink-2">{partyName(locale, p.partyId, p.partyLabel)}</span>
      </span>
    </span>
  );
}

/** The portfolio in the council's words, or a plain statement that its records give none. */
export function Portfolio({ locale, m }: { locale: Locale; m: CabinetMember }) {
  const t = cabinetMessages[locale];
  if (!m.posts.length) return <span className="text-ink-2">{m.unread ? t.portfolioUnread : t.noPortfolio}</span>;
  return <span lang={locale === "cy" ? "en" : undefined}>{m.posts.join("; ")}</span>;
}

/** Whether the council's wording already says the member's role ("Deputy Leader & Cabinet Member for Education"). */
function wordingSaysRole(m: CabinetMember): boolean {
  const test = m.role === "leader" ? saysLeader : m.role === "deputy" ? saysDeputyLeader : isExecutivePost;
  return m.posts.some(test);
}

/**
 * Cabinet members as rows: who, their role, and their post in the council's words. The role is left out in English
 * where the wording already says it; Welsh pages keep it, because the wording is usually English. Where the
 * council's records give no member a post, the rows don't each say so: the note under the list does.
 */
export function CabinetRows({ locale, councilId, members, noPosts = false }: { locale: Locale; councilId: string; members: CabinetMember[]; noPosts?: boolean }) {
  const t = cabinetMessages[locale];
  return (
    <ul className="rows">
      {members.map((m) => {
        const role = locale === "en" && wordingSaysRole(m) ? null : t.roles[m.role];
        return (
          <li key={m.councillorId} className="grid gap-x-8 gap-y-1 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <Holder locale={locale} councilId={councilId} p={m} />
            <p className="pl-[1.125rem] text-small sm:pl-0 sm:text-body">
              {role ? <span className="block text-ink-2">{role}</span> : null}
              {noPosts && !m.posts.length ? null : (
                <span className="block">
                  <Portfolio locale={locale} m={m} />
                </span>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** Chairs of a council's scrutiny and planning committees. */
export function ChairRows({ locale, councilId, chairs }: { locale: Locale; councilId: string; chairs: CommitteeChair[] }) {
  return (
    <ul className="rows">
      {chairs.map((c) => {
        const name = committeeName(locale, c.committeeEn, c.committeeCy);
        return (
          <li key={`${c.committeeId}-${c.councillorId}`} className="grid gap-x-8 gap-y-1 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <Holder locale={locale} councilId={councilId} p={c} />
            <p className="pl-[1.125rem] text-small sm:pl-0 sm:text-body">
              <Link href={href(locale, `/${councilId}/committees/${c.committeeId}`)} lang={name.lang}>
                {name.text}
              </Link>
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** How many of a Cabinet's members the council's records give no portfolio for, as a sentence; nothing when all have one. */
export function missingPortfolios(locale: Locale, c: CouncilCabinet): string | null {
  const t = cabinetMessages[locale];
  // The pages that give the portfolios have not been readable lately: say that, and not that the records give none.
  if (c.postsStaleSince) {
    const date = formatDate(locale, c.postsStaleSince);
    if (councilConfig(c.councilId)?.system === "vale") return fill(t.cabinetPageStale, { date });
    if (c.members.some((m) => m.unread)) return fill(t.postsStale, { date });
  }
  const without = c.members.filter((m) => !m.portfolio && m.role !== "leader").length;
  const others = c.members.filter((m) => m.role !== "leader").length;
  if (!without || !others) return null;
  if (without === others) return t.portfoliosMissingAll;
  return without === 1 ? t.portfoliosMissingOne : fill(t.portfoliosMissingSome, { n: formatNumber(locale, without) });
}

/**
 * "Who runs the council" on a council's overview: the leader, deputy leaders
 * and the first Cabinet members, with the rest and the committee chairs one
 * click away. Nothing is shown for a council whose records give no Cabinet.
 */
export async function CouncilCabinetBlock({ locale, councilId }: { locale: Locale; councilId: string }) {
  const c = await councilCabinet(councilId);
  if (!c || !c.members.length) return null;
  const t = cabinetMessages[locale];
  const first = c.members.slice(0, 5);
  const rest = c.members.slice(5);
  const missing = missingPortfolios(locale, c);
  const noPosts = !c.members.some((m) => m.posts.length);
  return (
    <Section id="cabinet" icon="council" title={t.block.title} className="border-t border-rule" aside={<Link href={href(locale, "/cabinets")}>{t.block.all}</Link>}>
      <p className="-mt-1 mb-2 max-w-[62ch] text-small text-ink-2">{t.block.lede}</p>
      <CabinetRows locale={locale} councilId={councilId} members={first} noPosts={noPosts} />
      {rest.length ? (
        <details className="border-t border-rule">
          <summary className="cursor-pointer py-3 text-small">{fill(t.block.showAll, { n: formatNumber(locale, c.members.length) })}</summary>
          <div className="border-t border-rule">
            <CabinetRows locale={locale} councilId={councilId} members={rest} noPosts={noPosts} />
          </div>
        </details>
      ) : null}
      {c.chairs.length ? (
        <details className="border-t border-rule">
          <summary className="cursor-pointer py-3 text-small">{fill(t.block.chairs, { n: formatNumber(locale, c.chairs.length) })}</summary>
          <div className="border-t border-rule">
            <ChairRows locale={locale} councilId={councilId} chairs={c.chairs} />
          </div>
        </details>
      ) : null}
      <p className="mt-3 max-w-[62ch] text-meta text-ink-2">
        {missing ? `${missing} ` : ""}
        {c.readOn ? fill(t.block.source, { date: formatDate(locale, c.readOn) }) : ""}
      </p>
    </Section>
  );
}

/** Cabinet members across Wales whose portfolio is named for a topic, with the council each belongs to. */
export function topicLeads(all: CouncilCabinet[], topic: string): Array<{ councilId: string; m: CabinetMember }> {
  return all.flatMap((c) => c.members.filter((m) => m.topics.includes(topic)).map((m) => ({ councilId: c.councilId, m })));
}

/** "Who leads on this" on a topic page: the first few lead members, and a link to them all. Nothing when no portfolio is named for the topic. */
export async function TopicLeadsBlock({ locale, topic }: { locale: Locale; topic: string }) {
  const t = cabinetMessages[locale];
  const leads = topicLeads(await allCabinets(), topic).sort((a, b) => sortName(locale, a.councilId).localeCompare(sortName(locale, b.councilId), locale));
  if (!leads.length) return null;
  return (
    <Section id="leads" title={t.topicBlock.title} className="border-t border-rule">
      <p className="-mt-1 mb-2 text-meta text-ink-2">{t.topicBlock.lede}</p>
      <ul className="rows text-small">
        {leads.slice(0, 4).map(({ councilId, m }) => (
          <li key={`${councilId}-${m.councillorId}`} className="py-2.5">
            <span className="text-ink-2">{sortName(locale, councilId)}</span>
            <span className="block">
              <Link href={href(locale, `/${councilId}/councillors/${m.councillorId}`)}>{m.name}</Link>
            </span>
            <span className="block text-meta text-ink-2" lang={locale === "cy" ? "en" : undefined}>
              {m.posts.join("; ")}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-small">
        <Link href={`${href(locale, "/cabinets")}?topic=${topic}`}>{fill(t.topicBlock.showAll, { n: formatNumber(locale, leads.length) })}</Link>
      </p>
    </Section>
  );
}

/** A council's short name in the page's language, for sorting and labels. */
export function sortName(locale: Locale, councilId: string): string {
  const c = councilConfig(councilId);
  return c ? councilShort(locale, c) : councilId;
}
