import { describe, expect, it } from "vitest";
import { textLanguage } from "./text";

// The opening of the answer to WQ100318, published in Welsh on the English Order Paper.
const WELSH_ANSWER =
  "Mae Llywodraeth Cymru yn gwella ac yn diogelu ansawdd y dŵr yn Afon Taf drwy waith partneriaeth gyda Cyfoeth Naturiol Cymru (CNC), Dŵr Cymru, awdurdodau lleol a rhanddeiliaid eraill.\n\nMae CNC wedi nodi bod dalgylch Taf/Elái yn ddalgylch cyfle drwy eu Datganiad Ardal ar gyfer Canol De Cymru. Mae hyn yn cefnogi dull hirdymor sy’n seiliedig ar ddalgylch, wedi’i alinio â’r Cynlluniau Rheoli Basnau Afonydd.";

const ENGLISH_ANSWER =
  "Natural Resources Wales (Cyfoeth Naturiol Cymru) and Dŵr Cymru are working with local authorities to improve water quality in the River Taff. We have provided funding for this work and will continue to monitor progress with our partners across the catchment.";

describe("textLanguage", () => {
  it("recognises a Welsh answer", () => {
    expect(textLanguage(WELSH_ANSWER)).toBe("cy");
  });

  it("recognises English text that names Welsh bodies", () => {
    expect(textLanguage(ENGLISH_ANSWER)).toBe("en");
  });

  it("won't guess on short or mixed text", () => {
    expect(textLanguage("Substantive response")).toBeNull();
    expect(textLanguage("Yes.")).toBeNull();
    expect(textLanguage(null)).toBeNull();
    expect(
      textLanguage(`${WELSH_ANSWER}\n\n${ENGLISH_ANSWER} ${ENGLISH_ANSWER}`),
    ).toBeNull();
  });
});
