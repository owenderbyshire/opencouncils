import { describe, expect, it } from "vitest";
import { PORTFOLIO_TOPIC_RULES, portfolioTopics } from "./portfolio-topics";
import { TOPIC_BY_SLUG } from "./topics";

/* Portfolio names as councils gave them in November 2026. */

describe("portfolioTopics", () => {
  it("lists a portfolio under each topic its name mentions", () => {
    expect(portfolioTopics("Cabinet Member for Housing and Planning")).toEqual(["housing", "planning"]);
    expect(portfolioTopics("Cabinet Member for Climate Change, Strategic Planning & Transport")).toEqual(["planning", "transport", "climate"]);
    expect(portfolioTopics("Cabinet Member for Finance, Modernisation & Performance")).toEqual(["budget", "council-running"]);
    expect(portfolioTopics("Deputy Leader & Cabinet Member for Education")).toEqual(["schools"]);
    expect(portfolioTopics("Cabinet Member for Social Services (Children’s Services & Safeguarding, Cabinet Member Job Share)")).toEqual(["social-care"]);
    expect(portfolioTopics("Cabinet Member for a Greener Powys")).toEqual(["climate"]);
    expect(portfolioTopics("Cabinet Member for a Caring Powys")).toEqual(["social-care"]);
    expect(portfolioTopics("Cabinet Member for Streetscene")).toEqual(["waste"]);
    expect(portfolioTopics("Cabinet Member Housing, Regulatory and Audit")).toEqual(["housing", "community-safety", "council-running"]);
    expect(portfolioTopics("Cabinet Member with Portfolio for Education, Culture and Welsh Language")).toEqual(["schools", "leisure-culture"]);
    expect(portfolioTopics("Cabinet Member for Homes")).toEqual(["housing"]);
  });

  it("leaves a portfolio whose name fits no topic under its council alone", () => {
    for (const name of [
      "Leader of the Council",
      "Cabinet Member",
      "Cabinet Member for Resources",
      "Cabinet Member for Social Justice, Cohesion & Digital",
      "Deputy Leader and Cabinet Member for a Fairer Powys",
      "Cabinet Member for Equalities & Engagement",
      "Executive Member for Strategic Leadership",
      "Cabinet Member - Development",
      "Cabinet Member for Assets and Infrastructure",
    ])
      expect(portfolioTopics(name)).toEqual([]);
  });

  it("keeps to what the words mean", () => {
    // Financial sustainability is the budget, not the climate.
    expect(portfolioTopics("Cabinet Member with Portfolio for Financial Sustainability, Assets & Commercial")).toEqual(["budget"]);
    // Environmental services are bins and streets; the word "environment" is not in the name.
    expect(portfolioTopics("Cabinet Member for Waste, Street Scene & Environmental Services")).toEqual(["waste"]);
    // "Council business" is how the council is run, not the economy.
    expect(portfolioTopics("Deputy Leader and Cabinet Member for Council Business and the Welsh Language")).toEqual(["leisure-culture", "council-running"]);
    expect(portfolioTopics("Cabinet Member for Emergency Planning")).toEqual([]);
    expect(portfolioTopics("Cabinet Member for Schools, Lifelong Learning and Skills")).toEqual(["schools"]);
  });

  it("reads past a political group's post in the same line", () => {
    expect(portfolioTopics("Leader of the Labour Group, Deputy Leader of Council, Cabinet Member Education and Regeneration")).toEqual(["schools", "economy"]);
    expect(portfolioTopics("Leader of Welsh Liberal Democrats Group and Cabinet Member for Adult Social Care")).toEqual(["social-care"]);
    expect(portfolioTopics("Leader of the Green Group and Cabinet Member for Finance")).toEqual(["budget"]);
  });

  it("takes several lines together", () => {
    expect(portfolioTopics("Deputy Leader", "Cabinet Member for Housing and Community Safety (Deputy Leader)")).toEqual(["housing", "community-safety"]);
  });

  it("only uses topics the site has, each once", () => {
    const topics = PORTFOLIO_TOPIC_RULES.map((r) => r.topic);
    expect(new Set(topics).size).toBe(topics.length);
    for (const t of topics) expect(TOPIC_BY_SLUG.has(t)).toBe(true);
    for (const r of PORTFOLIO_TOPIC_RULES) expect(r.words.length).toBeGreaterThan(0);
  });

  it("does not read a corporate business portfolio as the economy (Anglesey's executive posts, 12 November 2026)", () => {
    expect(portfolioTopics("Portfolio Holder - Deputy Leader, Finance, Corporate Business and Customer Experience")).toEqual(["budget", "council-running"]);
  });
});
