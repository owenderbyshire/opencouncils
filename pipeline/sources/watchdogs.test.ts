import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COUNCILS } from "../../data/curated/councils";
import { COUNCIL_ONS, readWatchdogs, tidyWatchdogs } from "./watchdogs";

/** A reply in the shape Edau's watchdogs feed gives. */
const reply = {
  feed: "watchdogs",
  organisation: { id: "o1", nameEn: "Cardiff Council" },
  audit_reports: [
    {
      id: "older", title: { en: "Cardiff Council – Older review", cy: null }, date: "2022-04-01", kind: "Local report",
      topic: { en: null, cy: null }, publisher_summary: { en: "An older review.", cy: null },
      url: { en: "https://audit.wales/publication/older", cy: null }, pdf: { en: null, cy: null }, ai_reading: null,
      link_confidence: "strong", owner_credit: "Auditor General for Wales. Open Government Licence.",
    },
    {
      id: "digital", title: { en: "Cardiff Council – Digital strategy", cy: "Cyngor Caerdydd – Strategaeth ddigidol" }, date: "2025-03-01", kind: "Local report",
      topic: { en: "Digital", cy: "Digidol" }, publisher_summary: { en: "We looked at the strategy.", cy: "Edrychon ni ar y strategaeth." },
      url: { en: "https://audit.wales/publication/digital", cy: "https://archwilio.cymru/cyhoeddiad/digidol" },
      pdf: { en: "https://audit.wales/digital.pdf", cy: null },
      ai_reading: {
        written_by: "ai", label: { en: "Written by AI.", cy: "Wedi'i ysgrifennu gan AI." }, findings_total: 5,
        findings: [
          { kind: "recommendation", text: { en: "The council should publish a plan.", cy: null }, page: 7, source_url: "https://audit.wales/digital.pdf#page=7" },
          { kind: "risk", text: { en: "" }, page: 8, source_url: null },
        ],
      },
      link_confidence: "strong", owner_credit: "Auditor General for Wales. Open Government Licence.",
    },
    { id: "bad", title: { en: "No address" }, date: "2025-01-01", url: { en: "javascript:alert(1)" }, owner_credit: "x" },
  ],
  ombudsman_letters: [
    { year: "2023-24", url: "https://www.ombudsman.wales/a.pdf", owner_credit: "Public Services Ombudsman for Wales" },
    { year: "2025-26", url: "https://www.ombudsman.wales/c.pdf", owner_credit: "Public Services Ombudsman for Wales" },
    { year: "2025-26", url: "https://www.ombudsman.wales/c-again.pdf", owner_credit: "Public Services Ombudsman for Wales" },
    { year: "2024", url: "http://insecure.example/b.pdf", owner_credit: "Public Services Ombudsman for Wales" },
  ],
};

describe("Edau's watchdogs feed", () => {
  it("keeps known fields, newest first, and drops what cannot be shown safely", () => {
    const w = tidyWatchdogs(reply);
    expect(w.reports.map((r) => r.id)).toEqual(["digital", "older"]);
    expect(w.reports[0]).toMatchObject({ title: { en: "Cardiff Council – Digital strategy", cy: "Cyngor Caerdydd – Strategaeth ddigidol" }, date: "2025-03-01", pdf: { en: "https://audit.wales/digital.pdf", cy: null } });
    // Only the finding with words survives; the total stays as Edau counts it.
    expect(w.reports[0].aiReading).toEqual({ findings: [{ kind: "recommendation", text: { en: "The council should publish a plan.", cy: null }, page: 7, sourceUrl: "https://audit.wales/digital.pdf#page=7" }], total: 5 });
    expect(w.reports[1].aiReading).toBeNull();
    expect(w.letters.map((l) => [l.year, l.url])).toEqual([
      ["2025-26", "https://www.ombudsman.wales/c.pdf"],
      ["2023-24", "https://www.ombudsman.wales/a.pdf"],
    ]);
  });

  it("never keeps an AI reading Edau has not labelled as written by AI", () => {
    const unlabelled = structuredClone(reply);
    (unlabelled.audit_reports[1].ai_reading as { written_by: string }).written_by = "edau";
    expect(tidyWatchdogs(unlabelled).reports[0].aiReading).toBeNull();
  });

  it("refuses a reply that is not the watchdogs feed", () => {
    expect(() => tidyWatchdogs({ feed: "inspections", rows: [] })).toThrow(/not the watchdogs feed/);
  });

  it("knows every council's ONS code", () => {
    expect(COUNCILS.filter((c) => c.nation === "Wales" && !COUNCIL_ONS[c.id]).map((c) => c.id)).toEqual([]);
  });

  describe("reading", () => {
    let server: http.Server;
    let base = "";
    const asked: { url?: string; auth?: string }[] = [];
    beforeAll(async () => {
      server = http.createServer((req, res) => {
        asked.push({ url: req.url, auth: req.headers.authorization });
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(reply));
      });
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/feed`;
    });
    afterAll(() => new Promise<void>((r) => server.close(() => r())));

    it("asks Edau by the council's ONS code, with the product key", async () => {
      const r = await readWatchdogs({ base, key: "edau_product_test" }, "W06000015");
      expect(r.ok && r.data.reports.length).toBe(2);
      expect(asked[0]).toEqual({ url: "/api/v1/feed/watchdogs?org=W06000015", auth: "Bearer edau_product_test" });
    });
  });
});
