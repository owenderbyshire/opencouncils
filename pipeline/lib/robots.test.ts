import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseRobots, ROBOTS_OVERRIDE_HOSTS, rulesFromReply } from "./robots";

/* Councils' own robots.txt files, as their ModernGov sites served them on 11 November 2026. */
const fixture = (name: string) => readFileSync(path.join(import.meta.dirname, "../fixtures/robots", `${name}.txt`), "utf8");

describe("robots.txt", () => {
  it("lets the pipeline read pages on a site that only closes its web service's description (Swansea)", () => {
    const r = parseRobots(fixture("swansea"));
    expect(r.allows("/mgListExecPosts.aspx?bcr=1")).toBe(true);
    expect(r.allows("/mgDelegatedDecisions.aspx?RP=0&DS=1&Next=true")).toBe(true);
    // "Disallow: /*.asmx$" closes the address that ends there, not the methods beneath it.
    expect(r.allows("/mgWebService.asmx")).toBe(false);
    expect(r.allows("/mgWebService.asmx/GetCommittees")).toBe(true);
  });

  it("reads a site that names other crawlers and leaves everyone else free (Cardiff, Gwynedd)", () => {
    const cardiff = parseRobots(fixture("cardiff"));
    expect(cardiff.allows("/mgListExecPosts.aspx?bcr=1")).toBe(true);
    // The same file closes the site to the crawlers it names.
    expect(parseRobots(fixture("cardiff"), "GPTBot").allows("/mgListExecPosts.aspx")).toBe(false);
    expect(parseRobots(fixture("cardiff"), "ClaudeBot").allows("/")).toBe(false);
    const gwynedd = parseRobots(fixture("gwynedd"));
    expect(gwynedd.allows("/mgParishCouncilDetailsList.aspx")).toBe(true);
    expect(parseRobots(fixture("gwynedd"), "TurnitinBot").allows("/mgParishCouncilDetailsList.aspx")).toBe(false);
  });

  it("stays out of a site that closes everything to everyone (Monmouthshire, Conwy)", () => {
    for (const council of ["monmouthshire", "conwy"]) {
      const r = parseRobots(fixture(council));
      expect(r.allows("/mgListExecPosts.aspx?bcr=1")).toBe(false);
      expect(r.allows("/mgDelegatedDecisions.aspx")).toBe(false);
      expect(r.allows("/")).toBe(false);
    }
    // Monmouthshire lets one named crawler read its calendar feed, and only that crawler.
    expect(parseRobots(fixture("monmouthshire"), "Googlebot").allows("/mgRss.aspx")).toBe(true);
    expect(parseRobots(fixture("monmouthshire")).allows("/mgRss.aspx")).toBe(false);
  });

  it("follows the rule that fits most closely, and Allow on a tie", () => {
    const r = parseRobots("User-agent: *\nDisallow: /private/\nAllow: /private/open.html\nDisallow: /tmp\nAllow: /tmp");
    expect(r.allows("/private/x")).toBe(false);
    expect(r.allows("/private/open.html")).toBe(true);
    expect(r.allows("/tmp")).toBe(true);
    expect(r.allows("/other")).toBe(true);
  });

  it("uses the group that names the pipeline before the one for everyone", () => {
    const r = parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: OpenCouncilBot\nDisallow: /search\nCrawl-delay: 5");
    expect(r.allows("/mgListExecPosts.aspx")).toBe(true);
    expect(r.allows("/search?q=x")).toBe(false);
    expect(r.crawlDelay).toBe(5);
  });

  it("closes nothing when there are no rules", () => {
    expect(parseRobots("").allows("/anything")).toBe(true);
    expect(parseRobots("User-agent: *\nDisallow:").allows("/anything")).toBe(true);
    expect(parseRobots("# nothing here").allows("/anything")).toBe(true);
  });

  it("is overridden only for the two hosts the owner agreed", () => {
    expect([...ROBOTS_OVERRIDE_HOSTS].sort()).toEqual(["democracy.merthyr.gov.uk", "modgovpub-eng.secure.conwy.gov.uk"]);
  });

  it("tells a site that closes a page from one whose robots.txt could not be read", () => {
    // No file at all closes nothing.
    expect(rulesFromReply({ ok: false, status: 404 }).allows("/mgListExecPosts.aspx")).toBe(true);
    expect(rulesFromReply({ ok: false, status: 404 }).unknown).toBeUndefined();
    // A web page where the file should be is no file either.
    expect(rulesFromReply({ ok: true, text: "<!doctype html><title>Not found</title>" }).allows("/anything")).toBe(true);
    // No answer, or a server error (Bridgend gave 504 on 11 November 2026): nothing is read, and nothing is said about its robots.txt.
    for (const status of [null, 500, 504]) {
      const r = rulesFromReply({ ok: false, status });
      expect(r.allows("/mgListExecPosts.aspx")).toBe(false);
      expect(r.unknown).toBe(true);
    }
    // A file that closes everything is a known answer.
    const closed = rulesFromReply({ ok: true, text: fixture("monmouthshire") });
    expect(closed.allows("/mgListExecPosts.aspx")).toBe(false);
    expect(closed.unknown).toBeUndefined();
  });
});
