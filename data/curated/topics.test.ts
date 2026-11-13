import { describe, expect, it } from "vitest";
import { topicsFor } from "./topics";

describe("topicsFor", () => {
  it("files items under the right topics", () => {
    expect(topicsFor("Budget Proposals 2027/28")).toContain("budget");
    expect(topicsFor("Council Tax Base 2027/28")).toContain("budget");
    expect(topicsFor("Homelessness Strategy")).toContain("housing");
    expect(topicsFor("School Organisation Proposal: Ysgol Gymraeg Treganna")).toContain("schools");
    expect(topicsFor("Planning application 25/01234/MJR, land at Llanishen")).toContain("planning");
    expect(topicsFor("20mph speed limit review")).toContain("transport");
    expect(topicsFor("Recycling Strategy")).toContain("waste");
  });
  it("leaves procedural items alone", () => {
    expect(topicsFor("Apologies for absence")).toEqual([]);
    expect(topicsFor("Declarations of Interest")).toEqual([]);
    expect(topicsFor("Minutes of the previous meeting")).toEqual([]);
  });
  it("doesn't match words inside other words", () => {
    expect(topicsFor("Part B report")).not.toContain("leisure-culture");
    expect(topicsFor("Carpark lease")).toEqual([]);
  });
});
