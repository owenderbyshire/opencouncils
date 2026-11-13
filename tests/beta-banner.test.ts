import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { BETA_BANNER_ATTR, BETA_BANNER_KEY, BETA_BANNER_SCRIPT } from "@/lib/beta-banner";
import { SITE } from "@/lib/site";

// The messages modules import Next's locale helper, which only works inside Next.
vi.mock("next/root-params", () => ({ lang: async () => "en" }));

/** Runs the script from <head> against a stand-in for the browser. */
function runScript(getItem: (key: string) => string | null) {
  const set: string[] = [];
  const document = { documentElement: { setAttribute: (name: string) => set.push(name) } };
  new Function("localStorage", "document", BETA_BANNER_SCRIPT)({ getItem }, document);
  return set;
}

describe("beta notice", () => {
  it("is hidden before the first paint once a reader has closed it", () => {
    expect(runScript((k) => (k === BETA_BANNER_KEY ? "1" : null))).toEqual([BETA_BANNER_ATTR]);
    expect(runScript(() => null)).toEqual([]);
  });

  it("still shows when storage is switched off", () => {
    expect(
      runScript(() => {
        throw new Error("SecurityError");
      }),
    ).toEqual([]);
  });

  it("is hidden by the same attribute the script sets", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "../src/components/beta-banner.tsx"), "utf8");
    expect(source).toContain(`[[${BETA_BANNER_ATTR}]_&]:hidden`);
    expect(source).toContain("print:hidden");
  });

  it("keeps the phone line short in both languages", async () => {
    const { common } = await import("@/i18n/messages/common");
    for (const locale of ["en", "cy"] as const) {
      const line = common[locale].beta.short.replace("{email}", SITE.contactEmail).replace(/\*\*|\[|\]\(\w+\)/g, "");
      expect(line.length, line).toBeLessThanOrEqual(46);
    }
  });
});
