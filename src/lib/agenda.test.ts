import { describe, expect, it } from "vitest";
import { isNotAMeeting, isRoutineItem, tidyMinute, tidyTitle } from "./agenda";

describe("agenda items", () => {
  it("leaves out routine items", () => {
    for (const t of [
      "Simultaneous Translation",
      "DECLARATIONS OF PERSONAL INTEREST",
      "TO SIGN AS A CORRECT RECORD THE DECISION RECORD OF THE MEETING HELD ON THE 21ST SEPTEMBER 2026",
      "PART A",
      "Chairs Announcements",
      "ELECT CHAIR",
      "VICE-CHAIR",
      "URGENT BUSINESS",
      "Attendance and Apologies / Croeso ac Ymddiheuriadau",
      "Action Sheet / Taflen Weithredu",
      "Live Event",
      "To Consider items from the Cabinet Forward Work Programme",
      "1. Apologies for absence",
      "Part 3",
      "PART 4",
      "Agenda.",
      "Public Open Forum.",
    ])
      expect(isRoutineItem(t), t).toBe(true);
    for (const t of [
      "TACKLING POVERTY SUPPORT FUND 2026/27",
      "Bulky Waste Collection Charges",
      "Blaenau Gwent Local Development Plan Annual Monitoring Report 2025-26",
      "QUESTION FROM COUNCILLOR TYSSUL EVANS TO COUNCILLOR LINDA EVANS, LEADER OF THE COUNCIL",
      "Renewal of a Sexual Entertainment Venue Licence - Playhouse Gentlemen's Club, 32 St Mary Street",
    ])
      expect(isRoutineItem(t), t).toBe(false);
  });

  it("turns shouted titles into sentences", () => {
    expect(tidyTitle("TACKLING POVERTY SUPPORT FUND 2026/27")).toBe("Tackling Poverty Support Fund 2026/27");
    expect(tidyTitle("QUESTION FROM COUNCILLOR TYSSUL EVANS TO COUNCILLOR LINDA EVANS, LEADER OF THE COUNCIL")).toBe(
      "Question from Councillor Tyssul Evans to Councillor Linda Evans, Leader of the Council",
    );
    expect(tidyTitle("BRING YOUR OWN DEVICE (BYOD) POLICY")).toBe("Bring Your Own Device (BYOD) Policy");
    expect(tidyTitle("APPOINTMENT OF LA GOVERNORS")).toBe("Appointment of LA Governors");
    expect(tidyTitle("MODERNISING EDUCATION PROGRAMME - TO CONSIDER A CONSULTATION DOCUMENT ON YSGOL BLAENAU")).toBe(
      "Modernising Education Programme - to Consider a Consultation Document on Ysgol Blaenau",
    );
    expect(tidyTitle("3. Bulky Waste Collection Charges")).toBe("Bulky Waste Collection Charges");
    expect(tidyTitle("CCTV")).toBe("CCTV");
    expect(tidyTitle("Public Open Forum.")).toBe("Public Open Forum");
    expect(tidyTitle("25/02001/FUL LAND AT EXAMPLE ROAD")).toBe("25/02001/FUL Land at Example Road");
    expect(tidyTitle("2026-27 BUDGET MONITORING REPORT")).toBe("2026-27 Budget Monitoring Report");
    expect(tidyTitle("2027/28 Budget")).toBe("2027/28 Budget");
    expect(tidyTitle("10-12 High Street, Newtown")).toBe("10-12 High Street, Newtown");
    expect(tidyTitle("4. Budget update")).toBe("Budget update");
    expect(tidyTitle("12a) Budget update")).toBe("Budget update");
    expect(tidyTitle("Item 4 - Budget update")).toBe("Budget update");
    expect(tidyTitle("7 - Budget update")).toBe("Budget update");
    expect(tidyTitle("Report of the Director, Children's Services etc.")).toBe("Report of the Director, Children's Services etc");
    expect(tidyTitle("Update from U.K.")).toBe("Update from U.K.");
  });

  it("joins letters spaced out for emphasis", () => {
    expect(tidyMinute("RESOLVED – (1) T H A T the report be noted")).toBe("RESOLVED – (1) THAT the report be noted");
    expect(tidyMinute("Item A and B were noted")).toBe("Item A and B were noted");
  });

  it("knows calendar entries that aren't meetings", () => {
    for (const t of ["Weekly Planning Lists", "Delegated Decisions", "Individual Cabinet Member Decisions"]) expect(isNotAMeeting(t), t).toBe(true);
    for (const t of ["Planning Committee", "Council", "Cabinet", "Planning, Taxi Licensing and Rights of Way Committee"]) expect(isNotAMeeting(t), t).toBe(false);
  });
});
