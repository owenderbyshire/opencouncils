import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots.txt", () => {
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
  const agents = (rule: (typeof rules)[number]) => [rule.userAgent ?? []].flat();

  it("keeps the rules for search engines as they were", () => {
    const everyone = rules.find((rule) => agents(rule).includes("*"));
    expect(everyone).toEqual({ userAgent: "*", allow: "/", disallow: ["/api/"] });
  });

  it("asks crawlers that train AI models to keep out of the whole site", () => {
    const training = rules.find((rule) => agents(rule).includes("GPTBot"));
    expect(training?.disallow).toBe("/");
    expect(agents(training!)).toEqual(expect.arrayContaining(["ClaudeBot", "CCBot", "Google-Extended", "Applebot-Extended"]));
  });

  it("never names a search engine or an assistant fetching a page for someone", () => {
    const named = rules.flatMap(agents);
    for (const agent of ["Googlebot", "Bingbot", "Applebot", "DuckDuckBot", "OAI-SearchBot", "ChatGPT-User", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User"]) {
      expect(named).not.toContain(agent);
    }
  });
});
