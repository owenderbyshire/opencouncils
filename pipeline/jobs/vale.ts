/**
 * The Vale of Glamorgan Council's committees, meetings, agendas and minutes,
 * read from its own pages (pipeline/sources/vale.ts), since it doesn't use
 * ModernGov. Records go into the same tables as every other council's, with
 * IDs made from each page's address, and link back to the council's pages.
 *
 *   pnpm pipeline vale [--from 2022-05-01] [--limit 150] [--force]
 */
import { and, eq, notInArray, sql } from "drizzle-orm";
import { agendaItems, attendance, committeeMembers, committees, councillors, decisions, documents, meetings, wards } from "../../src/db/schema";
import { slugify } from "../lib/text";
import { fetchBytes, fetchText } from "../lib/http";
import { PartialFailure, type Job } from "../lib/job";
import { pdfText } from "../lib/pdf";
import { addDays, argNumber, argString, mapLimit, sha1, today } from "../lib/util";
import { committeeKind, isProceduralItem, partyIdFor, resolvedText, SUMMARISED_KINDS } from "../sources/moderngov";
import {
  matchValeMinutes,
  matchValeName,
  parseValeCommittee,
  parseValeCouncillors,
  parseValeProfile,
  valeCommitteeKey,
  parseValeIndex,
  parseValeMeeting,
  splitValeMinutes,
  VALE_AGENDAS,
  VALE_BASE,
  valeApologies,
  valeCommitteeName,
  valePresent,
  type ValeCouncillor,
} from "../sources/vale";

const COUNCILLORS = `${VALE_BASE}/en/our_council/Council-Structure/councillors`;

const COUNCIL = "vale-of-glamorgan";
const INDEX = `${VALE_AGENDAS}/minutes,_agendas_and_reports.aspx`;
const MAX_DOC_CHARS = 60_000;
const MAX_DOCS_PER_MEETING = 25;

/** A stable positive 31-bit ID from a page's address. */
export function valeId(url: string): number {
  const n = Number.parseInt(sha1(url.toLowerCase()).slice(0, 8), 16) & 0x7fffffff;
  return n || 1;
}

async function readPdf(url: string): Promise<string | null> {
  const b = await fetchBytes(url);
  if (!b.ok) return null;
  return (await pdfText(b.bytes)).replace(/[ \t]+\n/g, "\n").trim();
}

export const valeJob: Job = {
  name: "vale",
  description: "The Vale of Glamorgan's committees, meetings, agendas and minutes, from its own pages",
  async run(ctx) {
    const from = argString(ctx.args, "from") ?? "2022-05-01";
    const limit = argNumber(ctx.args, "limit") ?? 150;
    const now = today();
    const problems: string[] = [];

    // 0. Councillors and wards, from the councillors page.
    let people: Array<ValeCouncillor & { id: number }> = [];
    const cr = await fetchText(COUNCILLORS, { fresh: true });
    const listed = cr.ok ? parseValeCouncillors(cr.text) : [];
    if (listed.length >= 40) {
      people = listed.map((c) => ({ ...c, id: valeId(c.url) }));
      const seats = new Map<string, { name: string; seats: number }>();
      for (const c of people) {
        if (!c.ward) continue;
        const slug = slugify(c.ward);
        seats.set(slug, { name: c.ward, seats: (seats.get(slug)?.seats ?? 0) + 1 });
      }
      for (const [slug, w] of seats)
        await ctx.db
          .insert(wards)
          .values({ councilId: COUNCIL, slug, nameEn: w.name, seats: w.seats })
          .onConflictDoUpdate({ target: [wards.councilId, wards.slug], set: { nameEn: w.name, seats: w.seats } });
      for (const c of people) {
        const row = {
          councilId: COUNCIL,
          id: c.id,
          name: c.name,
          honorific: null,
          wardSlug: c.ward ? slugify(c.ward) : null,
          partyLabel: c.party,
          partyId: partyIdFor(c.party),
          groupLabel: null,
          photoUrl: c.photoUrl,
          sourceUrl: c.url,
          keyPosts: [],
          termStart: null,
          current: true,
          updatedAt: new Date(),
        };
        await ctx.db.insert(councillors).values(row).onConflictDoUpdate({ target: [councillors.councilId, councillors.id], set: row });
      }
      await ctx.db
        .update(councillors)
        .set({ current: false })
        .where(and(eq(councillors.councilId, COUNCIL), notInArray(councillors.id, people.map((c) => c.id))));
      ctx.count("councillors", people.length);
      ctx.touched.add("councillors");
    } else problems.push(`councillors page: ${cr.ok ? `only ${listed.length} councillors found` : cr.error}`);

    // 1. Committees.
    const index = await fetchText(INDEX, { fresh: true });
    if (!index.ok) throw new Error(`Vale index unavailable: ${index.error}`);
    const links = parseValeIndex(index.text);
    if (links.length < 10) throw new Error(`Vale index lists only ${links.length} committees: the page may have changed`);

    const found: Array<{ id: number; kind: ReturnType<typeof committeeKind>; meetings: ReturnType<typeof parseValeCommittee> }> = [];
    for (const link of links) {
      const r = await fetchText(link.url, { fresh: true });
      if (!r.ok) {
        problems.push(`committee page ${link.url}: ${r.error}`);
        continue;
      }
      const name = valeCommitteeName(r.text) ?? link.title ?? "Committee";
      const id = valeId(link.url);
      const kind = committeeKind(name);
      const row = { councilId: COUNCIL, id, nameEn: name, nameCy: null, category: null, kind, active: true, sourceUrl: link.url };
      await ctx.db.insert(committees).values(row).onConflictDoUpdate({ target: [committees.councilId, committees.id], set: row });
      found.push({ id, kind, meetings: parseValeCommittee(r.text).filter((m) => m.date >= from) });
      ctx.count("committees");
    }

    // 1b. Each councillor's own page: contact details, committees and the council's own attendance record.
    if (people.length) {
      const committeeIds = new Set(found.map((c) => c.id));
      let read = 0;
      for (const c of people) {
        const r = await fetchText(c.url, { fresh: true });
        if (!r.ok) {
          problems.push(`councillor page ${c.url}: ${r.error}`);
          continue;
        }
        const p = parseValeProfile(r.text);
        // Committees they have left this year are marked "(Until 13 July)" in their roles.
        const ended = new Set(p.roles.filter((x) => x.until).map((x) => valeCommitteeKey(x.name)));
        const rows = (p.attendance?.rows ?? []).map((x) => {
          const id = x.url ? valeId(x.url) : null;
          return { name: x.name, committeeId: id !== null && committeeIds.has(id) ? id : null, held: x.held, attended: x.attended, apologies: x.apologies };
        });
        await ctx.db
          .update(councillors)
          .set({ email: p.email, phone: p.phone, officialAttendance: p.attendance ? { period: p.attendance.period, rows } : null })
          .where(and(eq(councillors.councilId, COUNCIL), eq(councillors.id, c.id)));
        const member = [...new Set(rows.filter((x) => x.committeeId !== null && !ended.has(valeCommitteeKey(x.name))).map((x) => x.committeeId!))];
        await ctx.db.delete(committeeMembers).where(and(eq(committeeMembers.councilId, COUNCIL), eq(committeeMembers.councillorId, c.id)));
        if (member.length)
          await ctx.db
            .insert(committeeMembers)
            .values(member.map((committeeId) => ({ councilId: COUNCIL, committeeId, councillorId: c.id, role: "member", roleRaw: null })))
            .onConflictDoNothing();
        ctx.count("committee memberships", member.length);
        read++;
      }
      ctx.count("councillor pages", read);
      if (read < people.length * 0.8) problems.push(`only ${read} of ${people.length} councillor pages read`);
    }

    // 2. Meetings, from each committee's list.
    const kindOf = new Map<number, string>();
    for (const c of found) {
      for (const m of c.meetings) {
        const id = valeId(m.url);
        kindOf.set(id, c.kind);
        await ctx.db
          .insert(meetings)
          .values({ councilId: COUNCIL, id, committeeId: c.id, date: m.date, startTime: m.time, sourceUrl: m.url, recordingUrl: m.recording })
          .onConflictDoUpdate({
            target: [meetings.councilId, meetings.id],
            set: { committeeId: c.id, date: m.date, sourceUrl: m.url, recordingUrl: m.recording },
          });
        ctx.count("meetings");
      }
    }
    const decisionNotices = new Map(found.flatMap((c) => c.meetings.filter((m) => m.decisionNotice).map((m) => [valeId(m.url), m.decisionNotice!])));

    // 3. Each meeting's page and minutes: new meetings, recent ones, and any still waiting for minutes.
    const todo = await ctx.db.execute<{ id: number; url: string; date: string; hash: string | null; minutes: boolean }>(sql`
      select id, source_url as url, date::text as date, detail_hash as hash, minutes_published as minutes
      from meetings
      where council_id = ${COUNCIL} and source_url is not null and date >= ${from}
        and (detail_fetched_at is null
          or date between ${addDays(now, -60)}::date and ${addDays(now, 30)}::date
          or (not minutes_published and date >= ${addDays(now, -180)}::date)
          or ${ctx.args.force === true})
      order by detail_fetched_at nulls first, date desc
      limit ${limit}`);
    ctx.log(`${todo.length} Vale meetings to check`);

    let failures = 0;
    await mapLimit([...todo], 2, async (row) => {
      const r = await fetchText(row.url, { fresh: true });
      if (!r.ok) {
        failures++;
        return;
      }
      const hash = sha1(r.text.replace(/<input[^>]*__VIEWSTATE[^>]*>/g, ""));
      if (hash === row.hash && row.minutes && ctx.args.force !== true) {
        ctx.count("unchanged");
        return;
      }
      const m = parseValeMeeting(r.text);
      const kind = kindOf.get(row.id) ?? "other";

      // Minutes: split at each minute and matched to the agenda's items; who attended, from the
      // "Present:" list and the apologies minute.
      let minuteFor = new Map<string, string>();
      const attended = new Map<number, "present" | "apologies">();
      if (m.minutes) {
        try {
          const text = await readPdf(m.minutes);
          if (text) {
            const parts = splitValeMinutes(text);
            minuteFor = matchValeMinutes(m.items, parts);
            if (people.length) {
              for (const n of valePresent(text)) {
                const who = matchValeName(n, people);
                if (who) attended.set(who.id, "present");
                else ctx.count("attendanceUnmatched");
              }
              for (const n of valeApologies(parts)) {
                const who = matchValeName(n, people);
                if (who && !attended.has(who.id)) attended.set(who.id, "apologies");
              }
            }
          } else ctx.count("minutesFailures");
        } catch (err) {
          ctx.count("minutesFailures");
          ctx.warn(`Vale minutes ${m.minutes}: ${(err as Error).message}`);
        }
      }

      // Report text, for meetings that get a summary or a preview.
      const docText = new Map<number, { text: string; pages: number }>();
      const inPreviewWindow = row.date >= addDays(now, -60) && row.date <= addDays(now, 30);
      if (SUMMARISED_KINDS.has(kind as never) && (minuteFor.size || inPreviewWindow)) {
        const existing = new Set(
          (
            await ctx.db
              .select({ id: documents.id })
              .from(documents)
              .where(and(eq(documents.councilId, COUNCIL), eq(documents.meetingId, row.id), sql`${documents.text} is not null`))
          ).map((d) => d.id),
        );
        const wanted = m.items.flatMap((i) => i.documents).filter((d) => !existing.has(valeId(d.url))).slice(0, MAX_DOCS_PER_MEETING);
        for (const d of wanted) {
          try {
            const text = await readPdf(d.url);
            if (!text) {
              ctx.count("documentFailures");
              continue;
            }
            docText.set(valeId(d.url), { text: text.slice(0, MAX_DOC_CHARS), pages: (text.match(/\f/g)?.length ?? 0) + 1 });
            ctx.count("documentsRead");
          } catch {
            ctx.count("documentFailures");
          }
        }
      }

      const itemId = (n: string) => valeId(`${row.url}#${n}`);
      await ctx.db.transaction(async (tx) => {
        await tx.delete(agendaItems).where(and(eq(agendaItems.councilId, COUNCIL), eq(agendaItems.meetingId, row.id)));
        if (m.items.length)
          await tx.insert(agendaItems).values(
            m.items.map((it, seq) => ({
              councilId: COUNCIL,
              id: itemId(it.number),
              meetingId: row.id,
              seq: seq + 1,
              number: it.number,
              title: it.title,
              agendaText: it.text,
              minutes: minuteFor.get(it.number) ?? null,
            })),
          );

        const docRows = [
          ...m.items.flatMap((it) =>
            it.documents.map((d) => ({ id: valeId(d.url), agendaItemId: itemId(it.number) as number | null, title: d.title || "Report", url: d.url })),
          ),
          ...(m.minutes ? [{ id: valeId(m.minutes), agendaItemId: null, title: "Minutes", url: m.minutes }] : []),
          ...(decisionNotices.get(row.id)
            ? [{ id: valeId(decisionNotices.get(row.id)!), agendaItemId: null, title: "Decision notice", url: decisionNotices.get(row.id)! }]
            : []),
        ].filter((d, i, all) => all.findIndex((x) => x.id === d.id) === i);
        const ids = docRows.map((d) => d.id);
        await tx
          .delete(documents)
          .where(and(eq(documents.councilId, COUNCIL), eq(documents.meetingId, row.id), ids.length ? notInArray(documents.id, ids) : undefined));
        for (const d of docRows) {
          const text = docText.get(d.id);
          await tx
            .insert(documents)
            .values({ councilId: COUNCIL, meetingId: row.id, ...d, text: text?.text ?? null, pages: text?.pages ?? null })
            .onConflictDoUpdate({
              target: [documents.councilId, documents.id],
              set: {
                meetingId: row.id,
                agendaItemId: d.agendaItemId,
                title: d.title,
                url: d.url,
                text: sql`coalesce(${text?.text ?? null}, ${documents.text})`,
                pages: sql`coalesce(${text?.pages ?? null}, ${documents.pages})`,
              },
            });
        }

        // Attendance only from minutes; the Vale doesn't record absences, so a councillor not listed isn't marked absent.
        if (attended.size) {
          await tx.delete(attendance).where(and(eq(attendance.councilId, COUNCIL), eq(attendance.meetingId, row.id)));
          await tx
            .insert(attendance)
            .values([...attended].map(([councillorId, status]) => ({ councilId: COUNCIL, meetingId: row.id, councillorId, status, statusRaw: status, role: null })))
            .onConflictDoNothing();
          ctx.count("attendance", attended.size);
        }

        await tx.delete(decisions).where(and(eq(decisions.councilId, COUNCIL), eq(decisions.meetingId, row.id)));
        const decided = m.items.flatMap((it) => {
          if (isProceduralItem(it.title)) return [];
          const text = resolvedText(minuteFor.get(it.number));
          return text ? [{ councilId: COUNCIL, meetingId: row.id, agendaItemId: itemId(it.number), text }] : [];
        });
        if (decided.length) await tx.insert(decisions).values(decided);
        ctx.count("decisions", decided.length);

        await tx
          .update(meetings)
          .set({
            date: m.date ?? row.date,
            startTime: m.time ?? undefined,
            location: m.venue,
            agendaPublished: m.items.length > 0,
            minutesPublished: minuteFor.size > 0,
            detailHash: hash,
            detailFetchedAt: new Date(),
          })
          .where(and(eq(meetings.councilId, COUNCIL), eq(meetings.id, row.id)));
      });
      ctx.count("meetingsRead");
      if (minuteFor.size) ctx.count("minuted");
      ctx.touched.add(`meeting:${COUNCIL}:${row.id}`);
    });

    ctx.touched.add("committees");
    ctx.touched.add("meetings");
    if (failures) problems.push(`${failures} meeting pages could not be fetched`);
    if (problems.length) throw new PartialFailure(problems.join("; "));
  },
};
