import Link from "next/link";
import { FilterGroup, Pagination } from "@/components/pagination";
import { authorityStats, listApplications, PLANNING_PAGE, type ApplicationRow, type PlanningFilter } from "@/data/planning";
import { href, type Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { planningMessages } from "@/i18n/messages/planning";
import type { PlanningStatus } from "@/lib/planning-status";

type T = (typeof planningMessages)["en"];

export const isOpen = (status: PlanningStatus) => status === "waiting";

/** The label for an application's status. Approvals keep the register's own wording (with or without conditions). */
export function stateLabel(t: T, status: PlanningStatus, state: string | null): string {
  switch (status) {
    case "approved":
      return t.states[state ?? "Permitted"] ?? t.states.Permitted;
    case "refused":
      return t.states.Rejected;
    case "decided":
      return t.states.Decided;
    case "withdrawn":
      return t.states.Withdrawn;
    case "referred":
      return t.states.Referred;
    case "waiting":
      return t.states.Undecided;
    default:
      return t.states.Unknown;
  }
}

/** A small text badge: the status is always written out, the dot only repeats it. */
export function StateBadge({ t, status, state }: { t: T; status: PlanningStatus; state: string | null }) {
  const tone =
    status === "waiting" ? "var(--accent)" : status === "refused" ? "var(--ink)" : status === "approved" ? "var(--ink-3)" : "var(--rule-strong)";
  return (
    <span className="inline-flex items-center gap-1.5 text-small font-medium">
      <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: tone }} />
      {stateLabel(t, status, state)}
    </span>
  );
}

export function ApplicationItem({ locale, a, extra }: { locale: Locale; a: ApplicationRow; extra?: React.ReactNode }) {
  const t = planningMessages[locale];
  return (
    <li className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <div className="text-small text-ink-2">
        {a.startDate ? <p>{t.received.replace("{date}", formatDate(locale, a.startDate))}</p> : null}
        {a.reference ? <p className="num">{a.reference}</p> : null}
      </div>
      <div className="min-w-0">
        <Link href={href(locale, `/planning/application/${a.id}`)} className="font-semibold" lang={locale === "cy" ? "en" : undefined}>
          {a.address || a.reference}
        </Link>
        {a.description ? (
          <p className="mt-1 line-clamp-2 max-w-[72ch] text-small" lang={locale === "cy" ? "en" : undefined}>
            {a.description}
          </p>
        ) : null}
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <StateBadge t={t} status={a.status} state={a.appState} />
          {a.decidedByCommittee ? (
            <span className="text-small text-ink-2">{isOpen(a.status) ? t.forCommittee : t.atCommittee}</span>
          ) : a.onAgenda ? (
            <span className="text-small text-ink-2">{t.onAgenda}</span>
          ) : null}
          {extra}
        </p>
      </div>
    </li>
  );
}

/** One authority's applications, filterable by state, with pages. */
export async function ApplicationList({
  locale,
  authority,
  path,
  filter,
  page,
}: {
  locale: Locale;
  authority: string;
  path: string;
  filter: PlanningFilter;
  page: number;
}) {
  const t = planningMessages[locale];
  const [{ rows, total }, stats] = await Promise.all([listApplications(authority, filter, page), authorityStats()]);
  const own = stats.find((s) => s.authority === authority);
  if (!own) return <p className="mt-4 max-w-[62ch] text-ink-2">{t.noDataAuthority}</p>;
  return (
    <>
      {own.stale && own.latest ? (
        <p className="mb-4 max-w-[62ch] text-small text-ink-2">{t.staleAuthority.replace("{date}", formatDate(locale, own.latest))}</p>
      ) : null}
      <FilterGroup
        label={t.show}
        locale={locale}
        path={path}
        param="show"
        current={filter}
        options={[
          { value: undefined, label: t.filters.all },
          { value: "open", label: t.filters.open },
          { value: "decided", label: t.filters.decided },
          { value: "committee", label: t.filters.committee },
        ]}
      />
      {rows.length ? (
        <ul className="rows mt-4">
          {rows.map((a) => (
            <ApplicationItem key={a.id} locale={locale} a={a} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-ink-2">{t.none}</p>
      )}
      <Pagination locale={locale} path={path} page={page} total={total} pageSize={PLANNING_PAGE} params={filter ? { show: filter } : {}} />
    </>
  );
}

/** The four stages of a planning application, as a numbered strip. */
export function Stages({ locale, current }: { locale: Locale; current?: 0 | 1 | 2 | 3 }) {
  const t = planningMessages[locale];
  const stages = [t.stages.received, t.stages.consultation, t.stages.decision, t.stages.after];
  return (
    <ol className="grid gap-4 md:grid-cols-4">
      {stages.map((s, i) => {
        const state = current === undefined ? null : i < current ? t.app.done : i === current ? t.app.now : t.app.next;
        return (
          <li
            key={s.title}
            className={`rounded border p-4 ${current !== undefined && i === current ? "border-accent bg-surface" : "border-rule"}`}
          >
            <p className="flex items-baseline gap-2">
              <span
                aria-hidden="true"
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-small font-semibold ${
                  current !== undefined && i <= current ? "bg-accent text-[var(--accent-ink)]" : "bg-surface-2 text-ink"
                }`}
              >
                {i + 1}
              </span>
              <span className="font-semibold">{s.title}</span>
            </p>
            {state ? <p className="mt-1 text-meta text-ink-2">{state}</p> : null}
            <p className="mt-2 text-small text-ink-2">{s.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
