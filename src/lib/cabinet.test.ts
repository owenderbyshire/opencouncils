import { describe, expect, it } from "vitest";
import { buildCabinet, isExecutivePost, isMainCabinet, namesPortfolio, officeHolderName, pickCabinet, roleInName, saysDeputyLeader, saysLeader, shownPost, sitsOnCabinet } from "./cabinet";

/* Every line below is a council's own wording, as its ModernGov service gave it in November 2026. */

describe("the leader of the council", () => {
  it.each([
    "Leader of the Council",
    "Leader of Council",
    "Council Leader",
    "Leader",
    "Leader of the Council/Cabinet Member Corporate Resources",
    "Leader and Cabinet Member for People, Performance and Partnerships",
    "Leader of the Council and Cabinet Member for Finance",
    "Cabinet Member - Economy, Finance and Strategy (Leader)",
    "Cabinet Member for Community and Strategic Leadership (Leader)",
    "Leader of the Council and Cabinet Member for Democratic Services, Policy, Performance and People and Organisation",
    "Leader/Executive Member - Corporate Services",
    "Executive Leader and Cabinet Member for Performance and Resources",
    "Leader of the County Council",
    "Leader of Flintshire County Council",
    "Arweinydd y Cyngor",
  ])("%s", (text) => {
    expect(saysLeader(text)).toBe(true);
    expect(isExecutivePost(text)).toBe(true);
  });

  it.each([
    "Leader of the Conservative Group",
    "Leader of the Liberal Democrat Group",
    "Leader of the Opposition",
    "Leader of the Opposition Group (Labour)",
    "Leader of the Gwynedd yn Gyntaf Group",
    "Leader of Plaid Cymru",
    "Leader of the RCT Welsh Conservative Group",
    "Leader of the Independent Group/Chair - Children, Young People & Families Scrutiny Committee",
    "Leader of Welsh Liberal Democrats Group and Cabinet Member for Adult Social Care",
    "Leader of the Labour Group, Deputy Leader of Council, Cabinet Member Education and Regeneration",
    "Deputy Leader",
    "Deputy Leader of the Council/Cabinet Member Neighbourhood & Environment Services",
    "Labour Group Leader",
    "Leader of the Independent Alliance on the Council",
    "Executive Member for Strategic Leadership",
    "Chair of the Council",
    "Dirprwy Arweinydd",
  ])("not the leader: %s", (text) => {
    expect(saysLeader(text)).toBe(false);
  });
});

describe("deputy leaders of the council", () => {
  it.each([
    "Deputy Leader",
    "Deputy Leader & Cabinet Member for Education",
    "Deputy Leader of the Council/Cabinet Member Neighbourhood & Environment Services",
    "Deputy Leader and Cabinet Member",
    "Deputy Leader and Cabinet Member for Children and Supporting Families",
    "Deputy Leader with Portfolio for Climate Change and Communities",
    "Cabinet Member for Planning and Economic Development and Deputy Leader",
    "Deputy Leader / Cabinet Member for Environment, Roads and Infrastructure",
    "Leader of the Labour Group, Deputy Leader of Council, Cabinet Member Education and Regeneration",
    "Cabinet Member - Transformation (Joint Deputy Leader)",
    "Cabinet Member for Housing and Community Safety (Deputy Leader)",
    "Deputy Leader/Executive Member - Environment",
    "Dirprwy Arweinydd",
  ])("%s", (text) => {
    expect(saysDeputyLeader(text)).toBe(true);
    expect(isExecutivePost(text)).toBe(true);
  });

  it.each([
    "Deputy Leader of the Independent Group/Chair - Governance & Resources Scrutiny Committee",
    "Deputy Leader of the Opposition / Chair of Aspirational Merthyr Tydfil Scrutiny",
    "Deputy Leader of Welsh Liberal Democrats Group",
    "Deputy Leader for Plaid Cymru",
    "Deputy Leader of the Opposition Group (Labour)",
    "Deputy Presiding Member",
    "Deputy Lord Mayor",
  ])("not a deputy leader of the council: %s", (text) => {
    expect(saysDeputyLeader(text)).toBe(false);
    expect(isExecutivePost(text)).toBe(false);
  });
});

describe("Cabinet seats", () => {
  it.each([
    "Cabinet Member for Housing & Communities (Housing & Homelessness, Cabinet Member Job Share)",
    "Cabinet Member with Portfolio for Social Care, Health & Youth Participation",
    "Cabinet Member - Adults & Communities",
    "Cabinet Member Children, Young People & Families",
    "Cabinet Member",
    "Joint Cabinet Member for Communities",
    "Executive Member for Waste and Sustainability",
    "Cabinet Member Rural Affairs, Communities, and Welsh Language",
    "Aelod Cabinet,Oedolion, Iechyd a Llesiant",
  ])("%s", (text) => expect(isExecutivePost(text)).toBe(true));

  it.each([
    "Chair of Planning and Licensing Committees",
    "Vice-Chair of Council",
    "Armed Forces Champion",
    "Presiding Member & Chair of Education O&S Committee",
    "Shadow Cabinet Member for Finance",
    "Assistant Cabinet Member for Housing",
    "Deputy Cabinet Member for Education",
    "Council Appointed Governor - Maes Ebbw Special School",
    "",
  ])("not a Cabinet seat: %s", (text) => expect(isExecutivePost(text)).toBe(false));

  it("tells a named portfolio from a bare seat", () => {
    expect(namesPortfolio("Cabinet Member for Education")).toBe(true);
    expect(namesPortfolio("Executive Member for Strategic Leadership")).toBe(true);
    expect(namesPortfolio("Cabinet Member - Community (Job Share)")).toBe(true);
    expect(namesPortfolio("Leader of the Council/Cabinet Member Corporate Resources")).toBe(true);
    expect(namesPortfolio("Cabinet Member")).toBe(false);
    expect(namesPortfolio("Deputy Leader and Cabinet Member")).toBe(false);
    expect(namesPortfolio("Leader of the Council")).toBe(false);
    expect(namesPortfolio("Council Leader")).toBe(false);
    expect(namesPortfolio("Deputy Leader")).toBe(false);
    // A group's leadership is not a portfolio.
    expect(namesPortfolio("Leader of the Labour Group, Deputy Leader of Council")).toBe(false);
  });
});

describe("a councillor's name in the directory", () => {
  it("reads the role Torfaen writes after the name, and leaves it off the name", () => {
    expect(roleInName("Anthony Hunt (Leader)")).toBe("Leader");
    expect(roleInName("Richard Clark (Deputy Leader)")).toBe("Deputy Leader");
    expect(officeHolderName("Anthony Hunt (Leader)")).toBe("Anthony Hunt");
  });
  it("leaves other brackets alone", () => {
    expect(roleInName("Siân Jones (Sian)")).toBeNull();
    expect(officeHolderName("Siân Jones (Sian)")).toBe("Siân Jones (Sian)");
    expect(roleInName("Peter Black CBE")).toBeNull();
  });
  it("drops a form of address and puts the first name first", () => {
    // Monmouthshire and Pembrokeshire write "County Councillor" before every name; Powys writes the surname first.
    expect(officeHolderName("County Councillor Mary Ann Brocklesby")).toBe("Mary Ann Brocklesby");
    expect(officeHolderName("County Councillor Dr Simon Hancock")).toBe("Dr Simon Hancock");
    expect(officeHolderName("Berriman, Jake")).toBe("Jake Berriman");
    expect(officeHolderName("Jones, Gareth D")).toBe("Gareth D Jones");
    expect(officeHolderName("Maureen Webber BEM")).toBe("Maureen Webber BEM");
    expect(officeHolderName("Chris Weaver")).toBe("Chris Weaver");
  });
});

describe("which committee is the Cabinet", () => {
  it("knows the body from its offshoots", () => {
    for (const name of ["Cabinet", "The Cabinet", "Executive", "The Executive", "Executive Board"]) expect(isMainCabinet(name)).toBe(true);
    for (const name of [
      "Cabinet (Trustee Maindy Park Trust)",
      "Cabinet Trust Committee",
      "Briefing - Cabinet",
      "Cabinet Member for Education",
      "Cardiff Capital Region City Deal Joint Cabinet",
      "Informal Cabinet",
      "Cabinet - Urgency Action",
      "Welsh Language Cabinet Sub Committee",
      "Individual Cabinet Member Decisions",
      "Cabinet - Appendices Index",
    ])
      expect(isMainCabinet(name)).toBe(false);
  });
  it("picks the one that meets, where two carry the name", () => {
    // Newport lists an old "Executive" beside its Cabinet.
    const picked = pickCabinet([
      { id: 197, nameEn: "Executive", members: 3, lastMeeting: "2012-03-01" },
      { id: 139, nameEn: "Cabinet", members: 10, lastMeeting: "2026-11-04" },
      { id: 442, nameEn: "Capital Region City Deal Joint Cabinet", members: 1, lastMeeting: "2026-10-20" },
    ]);
    expect(picked?.id).toBe(139);
  });
  it("gives none rather than guess", () => {
    expect(pickCabinet([{ id: 1, nameEn: "Cabinet", members: 0, lastMeeting: "2026-11-04" }])).toBeNull();
    expect(
      pickCabinet([
        { id: 1, nameEn: "Cabinet", members: 8, lastMeeting: "2026-11-04" },
        { id: 2, nameEn: "Executive", members: 8, lastMeeting: "2026-11-04" },
      ]),
    ).toBeNull();
    expect(pickCabinet([{ id: 3, nameEn: "Cabinet Sub Committee", members: 4, lastMeeting: "2026-11-04" }])).toBeNull();
  });
  it("leaves out people invited to the Cabinet who do not sit on it", () => {
    expect(sitsOnCabinet("member", "Committee Member")).toBe(true);
    expect(sitsOnCabinet("chair", "Chair")).toBe(true);
    expect(sitsOnCabinet("member", "Leader")).toBe(true);
    // Neath Port Talbot lists scrutiny chairs with its Cabinet as "Invitees".
    expect(sitsOnCabinet("member", "Invitees")).toBe(false);
    expect(sitsOnCabinet("observer", "Observer")).toBe(false);
    expect(sitsOnCabinet("substitute", "Substitute")).toBe(false);
  });
});

describe("the Cabinet as the council's records give it", () => {
  const member = (councillorId: number, name: string, keyPosts: string[] = [], role = "member", roleRaw: string | null = "Committee Member") => ({ councillorId, name, role, roleRaw, keyPosts });

  it("uses key posts where they name the portfolio (Gwynedd), not an older executive post page", () => {
    const r = buildCabinet({
      members: [
        member(46, "Nia Wyn Jeffreys", ["Council Leader"]),
        member(1223, "Menna Trenholme", ["Deputy Leader and Cabinet Member for Children and Supporting Families"]),
        member(1076, "June Jones", ["Cabinet Member for Highways, Engineering and Ymgynghoriaeth Gwynedd Consultancy"]),
      ],
      posts: [
        { postId: 172, title: "Leader", councillorId: 46 },
        { postId: 358, title: "Deputy Leader", councillorId: 1223 },
        { postId: 395, title: "Cabinet Member for Children and Young People", councillorId: 1223 },
        { postId: 399, title: "Cabinet Member for Highways and Municipal", councillorId: 1076 },
      ],
    });
    expect(r.leaderKnown).toBe(true);
    expect(r.seats.map((s) => [s.councillorId, s.role, s.posts, s.source])).toEqual([
      [46, "leader", ["Leader"], "executive-posts"],
      [1223, "deputy", ["Deputy Leader and Cabinet Member for Children and Supporting Families"], "key-posts"],
      [1076, "member", ["Cabinet Member for Highways, Engineering and Ymgynghoriaeth Gwynedd Consultancy"], "key-posts"],
    ]);
  });

  it("uses executive posts where key posts name only the seat (Carmarthenshire, Swansea)", () => {
    const r = buildCabinet({
      members: [
        member(150, "Linda Evans", ["Leader of the Council"]),
        member(122, "Hazel Evans", ["Deputy Leader and Cabinet Member"]),
        member(138, "Glynog Davies", ["Cabinet Member"]),
        member(630, "Cyril Anderson"),
        member(2192, "Rebecca Fogarty"),
      ],
      posts: [
        { postId: 357, title: "Leader of the Council", councillorId: 150 },
        { postId: 364, title: "Deputy Leader and Cabinet Member for Regeneration, Leisure, Culture & Tourism", councillorId: 122 },
        { postId: 361, title: "Cabinet Member for Education", councillorId: 138 },
        { postId: 572, title: "Cabinet Member - Community (Job Share)", councillorId: 630 },
        { postId: 572, title: "Cabinet Member - Community (Job Share)", councillorId: 2192 },
      ],
    });
    expect(r.seats.map((s) => [s.councillorId, s.role, s.posts, s.source, s.postIds])).toEqual([
      [150, "leader", ["Leader of the Council"], "executive-posts", [357]],
      [122, "deputy", ["Deputy Leader and Cabinet Member for Regeneration, Leisure, Culture & Tourism"], "executive-posts", [364]],
      [138, "member", ["Cabinet Member for Education"], "executive-posts", [361]],
      [630, "member", ["Cabinet Member - Community (Job Share)"], "executive-posts", [572]],
      [2192, "member", ["Cabinet Member - Community (Job Share)"], "executive-posts", [572]],
    ]);
  });

  it("leaves a group's posts out and keeps the council's (Neath Port Talbot)", () => {
    const r = buildCabinet({
      members: [member(57, "Scott Jones"), member(70, "Alun Llewelyn"), member(1112, "Charlotte Galsworthy", [], "member", "Invitees")],
      posts: [
        { postId: 195, title: "Leader", councillorId: 57 },
        { postId: 328, title: "Cabinet Member for Community and Strategic Leadership (Leader)", councillorId: 57 },
        { postId: 342, title: "Leader of Plaid Cymru", councillorId: 70 },
        { postId: 444, title: "Deputy Leader", councillorId: 70 },
        { postId: 511, title: "Cabinet Member for Housing and Community Safety (Deputy Leader)", councillorId: 70 },
      ],
    });
    expect(r.leaderKnown).toBe(true);
    expect(r.seats).toEqual([
      { councillorId: 57, role: "leader", posts: ["Cabinet Member for Community and Strategic Leadership (Leader)"], source: "executive-posts", postIds: [328] },
      { councillorId: 70, role: "deputy", posts: ["Cabinet Member for Housing and Community Safety (Deputy Leader)"], source: "executive-posts", postIds: [511] },
    ]);
  });

  it("lists a member with no portfolio when the records give none (Ceredigion)", () => {
    const r = buildCabinet({
      members: [member(146, "Bryan Davies", ["Leader of the Council"], "chair", "Chair"), member(117, "Alun Williams", [], "vice-chair", "Vice-Chair")],
      posts: [],
    });
    expect(r.seats).toEqual([
      { councillorId: 146, role: "leader", posts: ["Leader of the Council"], source: "key-posts", postIds: [] },
      { councillorId: 117, role: "member", posts: [], source: null, postIds: [] },
    ]);
  });

  it("reads the leader from the name or the Cabinet's own list where that is where the council writes it", () => {
    // Torfaen writes it after the name; Conwy gives it as the role on the Cabinet.
    const torfaen = buildCabinet({
      members: [member(49, "Anthony Hunt (Leader)", ["Executive Member for Strategic Leadership"]), member(10, "Richard Clark (Deputy Leader)", ["Executive Member for Children, Families & Education"])],
      posts: [],
    });
    expect(torfaen.seats.map((s) => s.role)).toEqual(["leader", "deputy"]);
    const conwy = buildCabinet({ members: [member(2364, "Julie Fallon", [], "member", "Leader")], posts: [] });
    expect(conwy.seats[0].role).toBe("leader");
  });

  it("takes a portfolio table's bare names as they are (the Vale of Glamorgan)", () => {
    const r = buildCabinet({
      members: [member(1, "Lis Burnett", [], "member", null), member(2, "Rhiannon Birch", [], "member", null)],
      posts: [
        { postId: 11, title: "Executive Leader and Cabinet Member for Performance and Resources", councillorId: 1 },
        { postId: 12, title: "Education, Arts and the Welsh Language", councillorId: 2 },
      ],
    });
    expect(r.seats).toEqual([
      { councillorId: 1, role: "leader", posts: ["Executive Leader and Cabinet Member for Performance and Resources"], source: "executive-posts", postIds: [11] },
      { councillorId: 2, role: "member", posts: ["Education, Arts and the Welsh Language"], source: "executive-posts", postIds: [12] },
    ]);
  });

  it("names no leader when two members' wording says so", () => {
    const r = buildCabinet({ members: [member(1, "A", ["Leader of the Council"]), member(2, "B", ["Leader"])], posts: [] });
    expect(r.leaderKnown).toBe(false);
    expect(r.leaderAmbiguous).toBe(true);
    expect(r.seats.every((s) => s.role === "member")).toBe(true);
  });

  it("does not call an opposition group leader on a shared Cabinet the leader (Pembrokeshire)", () => {
    const r = buildCabinet({
      members: [
        member(542, "Tessa Hodgson", ["Leader of Council"]),
        member(549, "Paul Miller", ["Leader of the Labour Group, Deputy Leader of Council, Cabinet Member Education and Regeneration"]),
        member(877, "Alistair Cameron", ["Leader of Welsh Liberal Democrats Group and Cabinet Member for Adult Social Care"]),
      ],
      posts: [],
    });
    expect(r.seats.map((s) => [s.councillorId, s.role])).toEqual([
      [542, "leader"],
      [549, "deputy"],
      [877, "member"],
    ]);
  });
});

describe("posts as shown", () => {
  it("leaves out a political group's post written into the same line (Flintshire, Blaenau Gwent, as their lists gave them on 11 November 2026)", () => {
    expect(shownPost("Leader of the Council / Leader of the Labour Group")).toBe("Leader of the Council");
    expect(shownPost("Leader of the Labour Group, Deputy Leader of Council, Cabinet Member Education and Regeneration")).toBe("Deputy Leader of Council, Cabinet Member Education and Regeneration");
    expect(shownPost("Leader of Welsh Liberal Democrats Group and Cabinet Member for Adult Social Care")).toBe("Cabinet Member for Adult Social Care");
    expect(shownPost("Cabinet Member for Housing and Communities")).toBe("Cabinet Member for Housing and Communities");
  });

  it("shows the cleaned wording in the Cabinet", () => {
    const r = buildCabinet({
      members: [{ councillorId: 1, name: "A", role: "member", roleRaw: null, keyPosts: ["Leader of the Council / Leader of the Labour Group"] }],
      posts: [],
    });
    expect(r.seats[0]).toMatchObject({ role: "leader", posts: ["Leader of the Council"] });
  });
});
