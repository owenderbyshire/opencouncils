import type { Metadata } from "next";
import { committeeName } from "@/lib/committees";
import { KindGuideLink } from "@/components/take-part";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MeetingItem } from "@/components/meeting-item";
import { PageHeader, Section } from "@/components/page-header";
import { BlockSkeleton, ListSkeleton } from "@/components/skeleton";
import { busiestCommitteeIds, getCommittee, listMeetings } from "@/data/council";
import { href, type Locale } from "@/i18n/config";
import { common } from "@/i18n/messages/common";
import { councilMessages } from "@/i18n/messages/council";
import { getLocale } from "@/i18n/server";
import { councilName, liveCouncil, LIVE_COUNCILS } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { committeeUrl } from "@/lib/official-urls";
import { atLeastOne } from "@/lib/params";
import { partyColour, partyName } from "@/lib/parties";
import { councilFrom, idFrom, isId } from "@/lib/route";

type Params = Promise<{ council: string; id: string }>;

export async function generateStaticParams() {
  const out = [];
  for (const c of LIVE_COUNCILS) for (const id of await busiestCommitteeIds(c.id, 3)) out.push({ council: c.id, id: String(id) });
  return atLeastOne(out, { council: LIVE_COUNCILS[0]?.id ?? "cardiff", id: "0" });
}

export async function generateMetadata({ params }: PageProps<"/[lang]/[council]/committees/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { council, id } = await params;
  const c = liveCouncil(council);
  const x = c && isId(id) ? await getCommittee(c.id, Number(id)) : null;
  if (!c || !x) return { title: common[locale].notFound.title };
  const name = committeeName(locale, x.nameEn, x.nameCy).text;
  return pageMetadata({
    locale,
    path: `/${c.id}/committees/${x.id}`,
    title: `${name}, ${councilName(locale, c)}`,
    description: councilMessages[locale].kindNotes[x.kind],
  });
}

export default async function CommitteePage({ params }: PageProps<"/[lang]/[council]/committees/[id]">) {
  const locale = await getLocale();
  const loading = common[locale].words.loading;
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={8} label={loading} />}>
        <Committee locale={locale} params={params} />
      </Suspense>
    </div>
  );
}

async function Committee({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  const x = await getCommittee(c.id, idFrom((await params).id));
  if (!x) notFound();
  const t = councilMessages[locale];
  const name = committeeName(locale, x.nameEn, x.nameCy);
  const official = x.sourceUrl ?? committeeUrl(c, x.id, locale);
  const roleLabel: Record<string, string> = {
    chair: t.committees.chair,
    "vice-chair": t.committees.viceChair,
    member: t.committees.member,
    substitute: t.committees.substitute,
    observer: t.committees.observer,
  };
  return (
    <>
      <PageHeader kicker={t.kinds[x.kind]} title={<span lang={name.lang}>{name.text}</span>} lede={
          <>
            {t.kindNotes[x.kind]} <KindGuideLink locale={locale} kind={x.kind} />
          </>
        }>
        {official ? (
          <p className="text-small">
            <a href={official}>{t.committees.officialPage}</a>
          </p>
        ) : null}
      </PageHeader>
      <div className="grid gap-x-14 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside className="min-w-0 lg:col-start-2 lg:row-start-1 lg:border-l lg:border-rule lg:pl-10">
          <Section id="members" title={t.committees.membersTitle} className="border-t border-rule lg:border-t-0">
            {x.members.length ? (
              <ul className="space-y-2 text-small">
                {x.members.map((p) => (
                  <li key={p.id} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: partyColour(p.partyId, p.partyLabel) }}
                    />
                    <span>
                      <Link href={href(locale, `/${c.id}/councillors/${p.id}`)}>{p.name}</Link>
                      {p.role !== "member" ? `, ${roleLabel[p.role] ?? p.role}` : ""}
                      <span className="block text-ink-2">{partyName(locale, p.partyId, p.partyLabel)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-small text-ink-2">{c.system === "vale" ? t.committees.membersUnavailable : t.committees.membersNone}</p>
            )}
          </Section>
        </aside>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Section id="meetings" title={t.committees.meetingsTitle} className="border-t border-rule">
            <Suspense fallback={<ListSkeleton rows={4} label={common[locale].words.loading} />}>
              <Meetings locale={locale} councilId={c.id} committeeId={x.id} />
            </Suspense>
          </Section>
        </div>
      </div>
    </>
  );
}

async function Meetings({ locale, councilId, committeeId }: { locale: Locale; councilId: string; committeeId: number }) {
  const t = councilMessages[locale];
  const [upcoming, past] = await Promise.all([
    listMeetings(councilId, { when: "upcoming", page: 1, committeeId }),
    listMeetings(councilId, { when: "past", page: 1, committeeId }),
  ]);
  const rows = [...upcoming.rows.slice(0, 3).reverse(), ...past.rows];
  if (!rows.length) return <p className="text-ink-2">{t.meetings.none}</p>;
  return (
    <div className="rows">
      {rows.map((r) => (
        <MeetingItem key={r.id} locale={locale} row={r} />
      ))}
    </div>
  );
}
