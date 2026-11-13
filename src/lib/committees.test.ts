import { describe, expect, it } from "vitest";
import { committeeName, welshCommitteeName } from "./committees";

describe("committee names", () => {
  it("gives Full Council and other standard committees their Welsh names", () => {
    expect(welshCommitteeName("Council")).toBe("Cyngor llawn");
    expect(welshCommitteeName("County Council")).toBe("Cyngor llawn");
    expect(welshCommitteeName("Full Council")).toBe("Cyngor llawn");
    expect(welshCommitteeName("Annual Council")).toBe("Cyfarfod blynyddol y Cyngor");
    expect(welshCommitteeName("Cabinet")).toBe("Cabinet");
    expect(welshCommitteeName("Planning Committee")).toBe("Pwyllgor Cynllunio");
    expect(welshCommitteeName("Governance & Audit Committee")).toBe("Pwyllgor Llywodraethu ac Archwilio");
  });
  it("leaves council-specific names in English", () => {
    expect(welshCommitteeName("Economy & Culture Scrutiny Committee")).toBeNull();
    expect(welshCommitteeName("Planning, Taxi Licensing and Rights of Way Committee")).toBeNull();
    expect(committeeName("cy", "Economy & Culture Scrutiny Committee", null)).toEqual({ text: "Economy & Culture Scrutiny Committee", lang: "en" });
  });
  it("prefers the council's own Welsh name, and leaves English pages alone", () => {
    expect(committeeName("cy", "Council", "Cyngor Sir")).toEqual({ text: "Cyngor Sir" });
    expect(committeeName("cy", "Council", null)).toEqual({ text: "Cyngor llawn" });
    expect(committeeName("en", "Council", null)).toEqual({ text: "Council" });
  });
});
