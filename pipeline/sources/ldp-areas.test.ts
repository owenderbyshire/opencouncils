import { describe, expect, it } from "vitest";
import { bbox, contains, siteLabel, type Geometry } from "./ldp-areas";

const square: Geometry = {
  type: "Polygon",
  coordinates: [
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
  ],
};

describe("allocated site boundaries", () => {
  it("finds points inside, outside and in holes", () => {
    expect(contains(square, 2, 2)).toBe(true);
    expect(contains(square, 5, 5)).toBe(false);
    expect(contains(square, 12, 2)).toBe(false);
    expect(contains({ type: "MultiPolygon", coordinates: [square.coordinates] }, 2, 8)).toBe(true);
  });
  it("gives the bounding box", () => {
    expect(bbox(square)).toEqual([0, 0, 10, 10]);
  });
  it("reads the site's label from the layer's own field names", () => {
    expect(siteLabel({ SITE_REF: "P01 HA1", SITE_NAME: "Land at Ffordd", area: 2 })).toEqual({ ref: "P01 HA1", name: "Land at Ffordd" });
    expect(siteLabel({ code: "HA", ref_no: "P42 HA2", address: "Land at Maes yr Esgob" })).toEqual({ ref: "P42 HA2", name: "Land at Maes yr Esgob" });
    expect(siteLabel({ fid: 3 })).toEqual({ ref: null, name: null });
  });
});
