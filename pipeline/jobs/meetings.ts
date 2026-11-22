/**
 * meetings: every meeting of every active committee in a window (by default
 *           the past four weeks and the next eight), from GetMeetings.
 * meeting-details: each meeting's agenda, documents, minutes, attendance and
 *           recorded decisions, from GetMeeting. A meeting is fetched again
 *           until its minutes are published and for a while after, and is
 *           skipped when its record hasn't changed.
 *
 *   pnpm pipeline meetings [--council cardiff] [--from 2022-05-01 --to 2026-10-31]
 *   pnpm pipeline meeting-details [--council cardiff] [--from ...] [--to ...] [--meeting 12345]
 *
 * For a backfill, run `meetings` with a wide window first, then
 * `meeting-details` with the same window.
 */
import { and, eq, gte, lte, notInArray, sql } from "drizzle-orm";
import {
  agendaItems,
  attendance,
  committees,
  councillors,
  decisions,
  documents,
  meetings,
} from "../../src/db/schema";
import { webServiceUrl } from "../../src/lib/official-urls";
import { councilsFor } from "../lib/councils";
import { fetchBytes, fetchText } from "../lib/http";
import { PartialFailure, type Job } from "../lib/job";
import { pdfText } from "../lib/pdf";
import { addDays, argNumber, argString, COUNCILS_AT_ONCE, dateWindows, mapLimit, sha1, today } from "../lib/util";
import {
  attendanceStatus,
  isoToUk,
  isProceduralItem,
  parseMeeting,
  parseMeetings,
  resolvedText,
  SUMMARISED_KINDS,
} from "../sources/moderngov";

export const meetingsJob: Job = {
  name: "meetings",
  watches: [
    {
      tags: ["meetings"],
      sources: [{ table: "meetings" }],
    },
  ],
  description: "Meetings of every active committee, from each council's ModernGov calendar",
  async run(ctx) {
    const from = argString(ctx.args, "from") ?? addDays(today(), -28);
    const to = argString(ctx.args, "to") ?? addDays(today(), 56);
    let failures = 0;
    let requests = 0;
    await mapLimit(councilsFor(ctx), COUNCILS_AT_ONCE, async (council) => {
      const active = await ctx.db
        .select({ id: committees.id })
        .from(committees)
        .where(and(eq(committees.councilId, council.id), eq(committees.active, true)));
      // ModernGov answers large date ranges slowly; ask a year at a time.
      const windows = dateWindows(from, to, 366);
      await mapLimit(
        active.flatMap((c) => windows.map((w) => ({ c, w }))),
        2,
        async ({ c, w }) => {
          requests++;
          const r = await fetchText(
            webServiceUrl(council.moderngovBase, "GetMeetings", {
              lCommitteeId: c.id,
              sFromDate: isoToUk(w[0]),
              sToDate: isoToUk(w[1]),
            }),
            { accept: "text/xml" },
          );
          if (!r.ok) {
            failures++;
            return;
          }
          for (const m of parseMeetings(r.text)) {
            const cancelled = /cancel|postpon/i.test(m.status);
            await ctx.db
              .insert(meetings)
              .values({
                councilId: council.id,
                id: m.meetingId,
                committeeId: c.id,
                date: m.date,
                startTime: m.time,
                status: m.status || null,
                cancelled,
              })
              .onConflictDoUpdate({
                target: [meetings.councilId, meetings.id],
                set: { committeeId: c.id, date: m.date, startTime: m.time, status: m.status || null, cancelled },
              });
            ctx.count(cancelled ? "cancelled" : "meetings");
          }
        },
      );
    });
    if (failures > requests / 4) throw new PartialFailure(`${failures} of ${requests} calendars could not be fetched`);
  },
};

/** Longest stretch of one document's text kept for summaries. */
const MAX_DOC_CHARS = 60_000;
/** Most documents read per meeting, largest reports first in agenda order. */
const MAX_DOCS_PER_MEETING = 25;

export const meetingDetailsJob: Job = {
  name: "meeting-details",
  description: "Agenda, documents, minutes, decisions and attendance for each meeting",
  async run(ctx) {
    const to = argString(ctx.args, "to") ?? today();
    const from = argString(ctx.args, "from") ?? addDays(to, -90);
    const only = argNumber(ctx.args, "meeting");
    let failures = 0;
    let total = 0;
    let sampleFailure = "";
    let sampleNotPdf = "";
    await mapLimit(councilsFor(ctx), COUNCILS_AT_ONCE, async (council) => {
      const known = new Set(
        (await ctx.db.select({ id: councillors.id }).from(councillors).where(eq(councillors.councilId, council.id))).map(
          (c) => c.id,
        ),
      );
      // Meetings in the window that haven't been settled: no minutes yet, or
      // minutes published within the last fortnight (councils correct them).
      const todo = await ctx.db
        .select({ id: meetings.id, kind: committees.kind, hash: meetings.detailHash })
        .from(meetings)
        .innerJoin(committees, and(eq(committees.councilId, meetings.councilId), eq(committees.id, meetings.committeeId)))
        .where(
          and(
            eq(meetings.councilId, council.id),
            eq(meetings.cancelled, false),
            only
              ? eq(meetings.id, only)
              : and(
                  gte(meetings.date, from),
                  lte(meetings.date, addDays(to, 21)),
                  sql`(${meetings.minutesPublished} = false or ${meetings.detailFetchedAt} is null or ${meetings.date} >= ${addDays(today(), -45)})`,
                ),
          ),
        );
      total += todo.length;
      ctx.log(`${council.id}: ${todo.length} meetings to check`);
      // Some councils' sites put report downloads behind a bot check (HTTP 403).
      // After a few refusals in a row, stop asking for this council's reports in this run.
      let refusals = 0;

      await mapLimit(todo, 2, async (row) => {
        const r = await fetchText(webServiceUrl(council.moderngovBase, "GetMeeting", { lMeetingId: row.id }), {
          accept: "text/xml",
        });
        if (!r.ok) {
          failures++;
          return;
        }
        const hash = sha1(r.text);
        if (hash === row.hash && !ctx.args.force) {
          ctx.count("unchanged");
          return;
        }
        const m = parseMeeting(r.text);
        if (!m) {
          failures++;
          return;
        }
        const summarised = SUMMARISED_KINDS.has(row.kind);
        const items = m.items.filter((i) => !i.isRestricted);

        // Text of agenda reports, for meetings that get a summary once their minutes are out.
        const docText = new Map<number, { text: string; pages: number }>();
        if (summarised && (m.minutesPublished || m.decisionsPublished)) {
          const existing = new Set(
            (
              await ctx.db
                .select({ id: documents.id })
                .from(documents)
                .where(and(eq(documents.councilId, council.id), eq(documents.meetingId, row.id), sql`${documents.text} is not null`))
            ).map((d) => d.id),
          );
          const wanted = items.flatMap((i) => i.documents).filter((d) => !existing.has(d.id)).slice(0, MAX_DOCS_PER_MEETING);
          for (const d of wanted) {
            if (refusals >= 5) {
              ctx.count("documentsSkippedBlocked");
              continue;
            }
            const b = await fetchBytes(d.url);
            refusals = !b.ok && b.error.startsWith("HTTP 403") ? refusals + 1 : 0;
            if (!b.ok) {
              ctx.count("documentFailures");
              ctx.count(`docFail ${b.error.slice(0, 40)}`);
              if (!sampleFailure) sampleFailure = `${d.url} ${b.error}`;
              continue;
            }
            // Some councils answer a missing or restricted document with an HTML page.
            if (!(b.bytes[0] === 0x25 && b.bytes[1] === 0x50 && b.bytes[2] === 0x44 && b.bytes[3] === 0x46)) {
              ctx.count("documentsNotPdf");
              if (!sampleNotPdf) sampleNotPdf = `${d.url} ${Buffer.from(b.bytes.slice(0, 80)).toString("utf8").replace(/\s+/g, " ")}`;
              continue;
            }
            try {
              const text = (await pdfText(b.bytes)).replace(/[ \t]+\n/g, "\n").trim();
              docText.set(d.id, { text: text.slice(0, MAX_DOC_CHARS), pages: (text.match(/\f/g)?.length ?? 0) + 1 });
              ctx.count("documentsRead");
            } catch (err) {
              ctx.count("documentFailures");
              ctx.count("docFail pdftotext");
              if (!sampleFailure) sampleFailure = `${d.url} ${(err as Error).message.slice(0, 120)}`;
            }
          }
        }

        const attendees = m.attendees
          .filter((a) => known.has(a.councillorId))
          .map((a) => ({ ...a, status: attendanceStatus(a.attendance) }))
          // "Expected" means attendance hasn't been recorded yet.
          .filter((a) => a.status !== "expected");

        await ctx.db.transaction(async (tx) => {
          const keyMeeting = and(eq(agendaItems.councilId, council.id), eq(agendaItems.meetingId, row.id));
          await tx.delete(agendaItems).where(keyMeeting);
          if (items.length)
            await tx.insert(agendaItems).values(
              items.map((i) => ({
                councilId: council.id,
                id: i.id,
                meetingId: row.id,
                seq: i.seq,
                number: i.number || null,
                title: i.title,
                isDecision: i.isDecision,
                isRestricted: i.isRestricted,
                declarationCount: i.declarationCount,
                agendaText: i.agendaText,
                minutes: i.minutes,
              })),
            );

          // Documents: keep extracted text from earlier runs.
          const docRows = items.flatMap((i) =>
            i.documents.map((d) => ({
              councilId: council.id,
              id: d.id,
              meetingId: row.id,
              agendaItemId: i.id,
              title: d.title,
              url: d.url,
              published: d.published,
              isDecisionAttachment: d.isDecisionAttachment,
              text: docText.get(d.id)?.text ?? null,
              pages: docText.get(d.id)?.pages ?? null,
            })),
          );
          const docIds = docRows.map((d) => d.id);
          await tx
            .delete(documents)
            .where(
              and(
                eq(documents.councilId, council.id),
                eq(documents.meetingId, row.id),
                docIds.length ? notInArray(documents.id, docIds) : undefined,
              ),
            );
          for (const d of docRows) {
            await tx
              .insert(documents)
              .values(d)
              .onConflictDoUpdate({
                target: [documents.councilId, documents.id],
                set: {
                  meetingId: d.meetingId,
                  agendaItemId: d.agendaItemId,
                  title: d.title,
                  url: d.url,
                  published: d.published,
                  isDecisionAttachment: d.isDecisionAttachment,
                  text: sql`coalesce(${d.text}, ${documents.text})`,
                  pages: sql`coalesce(${d.pages}, ${documents.pages})`,
                },
              });
          }

          await tx.delete(attendance).where(and(eq(attendance.councilId, council.id), eq(attendance.meetingId, row.id)));
          if (attendees.length)
            await tx
              .insert(attendance)
              .values(
                attendees.map((a) => ({
                  councilId: council.id,
                  meetingId: row.id,
                  councillorId: a.councillorId,
                  status: a.status as Exclude<typeof a.status, "expected">,
                  statusRaw: a.attendance,
                  role: a.role || null,
                })),
              )
              .onConflictDoNothing();

          await tx.delete(decisions).where(and(eq(decisions.councilId, council.id), eq(decisions.meetingId, row.id)));
          const decided = items.flatMap((i) => {
            if (isProceduralItem(i.title)) return [];
            const text = resolvedText(i.minutes);
            return text ? [{ councilId: council.id, meetingId: row.id, agendaItemId: i.id, text }] : [];
          });
          if (decided.length) await tx.insert(decisions).values(decided);
          ctx.count("decisions", decided.length);

          await tx
            .update(meetings)
            .set({
              location: m.location,
              startTime: m.time ?? undefined,
              agendaPublished: m.agendaPublished,
              minutesPublished: m.minutesPublished,
              decisionsPublished: m.decisionsPublished,
              detailHash: hash,
              detailFetchedAt: new Date(),
            })
            .where(and(eq(meetings.councilId, council.id), eq(meetings.id, row.id)));
        });
        ctx.count("meetings");
        ctx.count("attendance", attendees.length);
        ctx.touched.add(`meeting:${council.id}:${row.id}`);
      });
    });
    if (ctx.stats.meetings) {
      ctx.touched.add("meetings");
      ctx.touched.add("councillors");
    }
    if (sampleFailure) ctx.stats.sampleDocFailure = sampleFailure.slice(0, 300);
    if (sampleNotPdf) ctx.stats.sampleNotPdf = sampleNotPdf.slice(0, 300);
    if (failures > total / 4) throw new PartialFailure(`${failures} of ${total} meetings could not be read`);
  },
};

