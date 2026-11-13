import { describe, expect, it } from "vitest";
import { preferHttps } from "./http";

describe("preferHttps", () => {
  it("reads council ModernGov links over HTTPS", () => {
    expect(preferHttps("http://democracy.merthyr.gov.uk/documents/s1/x.pdf")).toBe("https://democracy.merthyr.gov.uk/documents/s1/x.pdf");
    expect(preferHttps("http://democracy.npt.gov.uk/mgConvert2PDF.aspx?ID=1")).toBe("https://democracy.npt.gov.uk/mgConvert2PDF.aspx?ID=1");
  });
  it("leaves other links alone", () => {
    expect(preferHttps("http://example.com/a")).toBe("http://example.com/a");
    expect(preferHttps("https://democracy.merthyr.gov.uk/a")).toBe("https://democracy.merthyr.gov.uk/a");
  });
});
