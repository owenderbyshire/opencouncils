import { describe, expect, it } from "vitest";
import { groupIssues, isProcedural, issueWords } from "./issues";

const item = (agendaItemId: number, meetingId: number, committeeId: number, date: string, title: string) => ({
  agendaItemId,
  meetingId,
  committeeId,
  date,
  title,
});

describe("issues", () => {
  it("strips routing words and keeps years", () => {
    expect(issueWords("Reference from Cabinet: Budget Proposals 2027/28")).toEqual(["budget", "y202728"]);
    expect(issueWords("Ref from Cab – Waycock Cross to Cardiff Airport Active Travel Route")).toEqual([
      "waycock",
      "cros",
      "cardiff",
      "airport",
      "active",
      "travel",
      "route",
    ]);
  });

  it("knows procedural items", () => {
    expect(isProcedural("Apologies for absence.")).toBe(true);
    expect(isProcedural("3. Minutes of the Meeting held on 23rd July 2026.")).toBe(true);
    expect(isProcedural("Eastern Gateway Project")).toBe(false);
  });

  it("groups the same report across committees, and keeps different years apart", () => {
    const groups = groupIssues([
      item(1, 10, 1, "2026-07-23", "Waycock Cross to Cardiff Airport Active Travel Route"),
      item(2, 20, 2, "2026-10-05", "Ref from Cab – Waycock Cross to Cardiff Airport Active Travel Route"),
      item(3, 30, 1, "2026-09-24", "Biglis to Dinas Powys Active Travel Route Compulsory Purchase Order"),
      item(4, 20, 2, "2026-10-05", "Biglis to Dinas Powys Active Travel Route Compulsory Purchase Order"),
      item(5, 40, 3, "2026-01-10", "Revenue Budget Proposals 2026/27"),
      item(6, 50, 3, "2027-01-10", "Revenue Budget Proposals 2027/28"),
      item(9, 45, 4, "2027-01-20", "Reference from Cabinet: Revenue Budget Proposals 2027/28"),
      item(7, 60, 2, "2026-03-01", "Apologies for absence"),
      item(8, 70, 2, "2026-04-01", "Apologies for absence"),
    ]);
    expect(groups.map((g) => g.map((i) => i.agendaItemId))).toEqual([
      [1, 2],
      [3, 4],
      [6, 9],
    ]);
  });

  it("leaves out the routine items councils repeat at every meeting", () => {
    for (const t of [
      "Disclosure of Personal & Prejudicial Interests",
      "TO SIGN AS A CORRECT RECORD THE MINUTES OF THE MEETING HELD ON 1 SEPTEMBER",
      "PART 1",
      "VICE-CHAIR",
      "Access to Meetings",
      "Simultaneous Translation",
      "Live Event",
      "Attendance / Presenoldeb",
      "Action Sheet",
      "Items for deferral/withdrawal",
    ])
      expect(isProcedural(t)).toBe(true);
  });

  it("doesn't chain different reports together", () => {
    const filler = Array.from({ length: 40 }, (_, i) => item(100 + i, 900 + i, 9, "2026-01-01", `Unrelated matter number ${i} on licensing code practice quarter`));
    const groups = groupIssues([
      ...filler,
      item(1, 10, 1, "2026-06-01", "Taxi Licensing Code of Practice"),
      item(2, 20, 2, "2026-07-01", "Licensing Sub-Committee Code of Practice"),
      item(3, 30, 1, "2026-06-10", "Corporate Strategy Performance Quarter 1"),
      item(4, 40, 2, "2026-07-10", "Corporate Strategy Annual Report 2025/26"),
    ]);
    const ids = groups.map((g) => g.map((i) => i.agendaItemId).sort());
    expect(ids).not.toContainEqual([1, 2]);
    expect(ids).not.toContainEqual([3, 4]);
  });
});
