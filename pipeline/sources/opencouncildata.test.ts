import { describe, expect, it } from "vitest";
import { REGISTER } from "../../data/curated/councils";
import { compositions, councilMatcher, ocdPartyId, parseCouncillors, parseHistory } from "./opencouncildata";

const HISTORY = `id,council id,authority,year,total,con,lab,ld,green,ukip,ref,pc,snp,other,majority,
14,228,Barnet,2016,63,32,30,1,0,0,0,0,0,0,Con,
1,295,Aberdeen City,2016,43,2,17,5,0,0,0,0,16,3,Lab plurality,
9,262,Manchester,2026,96,0,80,10,4,0,0,0,0,2,Lab,
`;
const CSV = `Council,"Ward Name","Councillor Name","Next Election","Party Name","Electoral Commission Party Code"
Manchester,Ancoats,"A Person",2027-05-06,"Labour Party",PP53
Manchester,Didsbury,"B Person",2027-05-06,"Liberal Democrats",PP90
Manchester,Hulme,"C Person",2027-05-06,"Labour Party",PP53
Belfast,Botanic,"D Person",2027-05-06,"Sinn Féin",PP39
Belfast,Lisnasharragh,"E Person",2027-05-06,"Conservative and Unionist",PP52
Nowhere,X,"F Person",2027-05-06,"Independent / Other",
`;

describe("Open Council Data", () => {
  it("reads the history file", () => {
    const h = parseHistory(HISTORY);
    expect(h).toHaveLength(3);
    expect(h[1]).toMatchObject({ ocdId: "295", authority: "Aberdeen City", year: 2016, total: 43, control: "Lab plurality" });
  });
  it("matches councils by the register's ids, then by name, and counts seats", () => {
    const match = councilMatcher(REGISTER, parseHistory(HISTORY));
    expect(match("Manchester")).toBe("manchester");
    expect(match("Barnet")).toBe("barnet");
    expect(match("Belfast")).toBe("belfast");
    const { found, unmatched } = compositions(parseCouncillors(CSV), match);
    expect(unmatched).toEqual(["Nowhere"]);
    const man = found.find((f) => f.councilId === "manchester")!;
    expect(man.seats).toBe(3);
    expect(man.parties[0]).toEqual({ label: "Labour Party", partyId: "lab", seats: 2 });
  });
  it("maps their party names to ours", () => {
    expect(ocdPartyId("Conservative and Unionist")).toBe("con");
    expect(ocdPartyId("Liberal Democrats")).toBe("ld");
    expect(ocdPartyId("Reform UK")).toBe("reform");
    expect(ocdPartyId("Green Party")).toBe("green");
    expect(ocdPartyId("Sinn Féin")).toBe("sf");
    expect(ocdPartyId("Scottish National Party (SNP)")).toBe("snp");
    expect(ocdPartyId("Plaid Cymru - The Party of Wales")).toBe("pc");
    expect(ocdPartyId("Independent / Other")).toBe("ind");
    expect(ocdPartyId("Vacant")).toBeNull();
  });
});
