import { describe, expect, it } from "vitest";
import { formatList } from "@/i18n/format";
import { andPlace, ynPlace } from "@/i18n/welsh";

describe("andPlace", () => {
  it("applies the aspirate mutation after a, and uses ac before a vowel", () => {
    expect(andPlace("Torfaen")).toBe("a Thorfaen");
    expect(andPlace("Caerdydd")).toBe("a Chaerdydd");
    expect(andPlace("Powys")).toBe("a Phowys");
    expect(andPlace("Pen-y-bont ar Ogwr")).toBe("a Phen-y-bont ar Ogwr");
    expect(andPlace("Merthyr Tudful")).toBe("a Merthyr Tudful");
    expect(andPlace("Sir y Fflint")).toBe("a Sir y Fflint");
    expect(andPlace("Ynys Môn")).toBe("ac Ynys Môn");
  });
  it("is used for Welsh lists of places only", () => {
    expect(formatList("cy", ["Abertawe", "Rhondda Cynon Taf", "Torfaen"], { places: true })).toBe("Abertawe, Rhondda Cynon Taf a Thorfaen");
    expect(formatList("cy", ["Llafur 3", "Plaid Cymru 2"])).toBe("Llafur 3 a Plaid Cymru 2");
    expect(formatList("en", ["Swansea", "Torfaen"], { places: true })).toBe("Swansea and Torfaen");
  });
});

describe("ynPlace", () => {
  it("applies the nasal mutation after yn", () => {
    expect(ynPlace("Caerdydd")).toBe("yng Nghaerdydd");
    expect(ynPlace("Gwynedd")).toBe("yng Ngwynedd");
    expect(ynPlace("Powys")).toBe("ym Mhowys");
    expect(ynPlace("Bro Morgannwg")).toBe("ym Mro Morgannwg");
    expect(ynPlace("Torfaen")).toBe("yn Nhorfaen");
    expect(ynPlace("Dinbych")).toBe("yn Ninbych");
    expect(ynPlace("Merthyr Tudful")).toBe("ym Merthyr Tudful");
    expect(ynPlace("Sir Gâr")).toBe("yn Sir Gâr");
    expect(ynPlace("Rhondda Cynon Taf")).toBe("yn Rhondda Cynon Taf");
    expect(ynPlace("Ynys Môn")).toBe("yn Ynys Môn");
  });
});
