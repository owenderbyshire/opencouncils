import { describe, expect, it } from "vitest";
import { ACTIVE_COUNCILS } from "../../data/curated/councils";
import { HISTORY_FROM, nextRelayWindow, throughRelay } from "./history";

describe("a relayed council's history, a quarter at a time", () => {
  it("reads the quarter before the earliest date read, and stops at HISTORY_FROM", () => {
    expect(nextRelayWindow("2026-10-11")).toEqual({ from: "2026-07-11", to: "2026-10-10" });
    expect(nextRelayWindow("2022-01-15")).toEqual({ from: HISTORY_FROM, to: "2022-01-14" });
    expect(nextRelayWindow(HISTORY_FROM)).toBeNull();
    expect(nextRelayWindow("2021-06-01")).toBeNull();
  });

  it("knows which councils go through the relay", () => {
    const anglesey = ACTIVE_COUNCILS.find((c) => c.id === "anglesey");
    expect(anglesey && throughRelay(anglesey)).toBe(true);
    expect(throughRelay({ moderngovBase: "https://cardiff.moderngov.co.uk" })).toBe(false);
    expect(throughRelay({ moderngovBase: null })).toBe(false);
    expect(throughRelay({ moderngovBase: "not a url" })).toBe(false);
  });

  it("takes about five years in twenty quarters", () => {
    let reached = "2026-10-11";
    let runs = 0;
    for (let w = nextRelayWindow(reached); w; w = nextRelayWindow(reached)) {
      reached = w.from;
      runs++;
    }
    expect(reached).toBe(HISTORY_FROM);
    expect(runs).toBeGreaterThanOrEqual(19);
    expect(runs).toBeLessThanOrEqual(21);
  });
});
