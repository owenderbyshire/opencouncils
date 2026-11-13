/**
 * "How councils work": a plain guide to Welsh local government, and a
 * glossary. General and accurate for all 22 councils; where councils differ,
 * it says "most" or "many" and points to the council's own website.
 */
import { defineMessages } from "../server";

export interface GuideSection {
  id: string;
  title: string;
  paras: string[];
}

export interface GlossaryTerm {
  id: string;
  term: string;
  def: string;
}

export const guideMessages = defineMessages<{
  title: string;
  lede: string;
  contents: string;
  sections: GuideSection[];
  glossaryTitle: string;
  glossaryLede: string;
  glossary: GlossaryTerm[];
  termLink: string;
}>({
  en: {
    title: "How councils work",
    lede: "A short guide to Welsh councils: what they do, who decides, how meetings work, and how you can have your say.",
    contents: "On this page",
    sections: [
      {
        id: "what",
        title: "What your council does",
        paras: [
          "Wales has 22 councils, sometimes called local authorities. Each one runs most of the local public services in its area: schools, social care for children and adults, bin collections and recycling, local roads and parking, planning, housing and homelessness, libraries and leisure, licensing, and environmental health.",
          "Some things are run by others. The NHS in Wales is run by health boards. Trunk roads and motorways are the Welsh Government's. Police and fire services have their own authorities. In a national park, the national park authority deals with planning. Wales also has over 700 community and town councils, which are smaller and separate.",
          "Councils are paid for mostly by money from the Welsh Government, and by council tax. Business rates are collected by councils but pooled across Wales and shared out by the Welsh Government as part of that money.",
        ],
      },
      {
        id: "who",
        title: "Who decides",
        paras: [
          "Councillors are elected by the people of each ward to represent them. Welsh council elections are held every five years; the next are in May 2027. People aged 16 and over can vote, including foreign citizens who live in Wales legally.",
          "Every Welsh council is run by a leader and a cabinet. The councillors choose a leader, usually from the largest party or group. The leader picks a cabinet of up to ten councillors, each responsible for an area such as education or housing. The cabinet makes most of the big day-to-day decisions.",
          "All the councillors together form the full Council. It sets the budget and council tax each year, agrees the council's main plans and its constitution, and chooses the leader.",
          "Council staff, called officers, give advice, write the reports councillors read, and make many routine decisions themselves under powers the council gives them. These are called delegated decisions.",
        ],
      },
      {
        id: "scrutiny",
        title: "Keeping decisions in check",
        paras: [
          "Councillors who are not in the cabinet sit on scrutiny committees. These question cabinet members and officers, look into how services are working, and make recommendations. If they think a cabinet decision is wrong, they can call it in before it takes effect and ask the cabinet to think again.",
          "A governance and audit committee checks the council's finances and how it manages risk. A standards committee deals with how councillors behave. Councillors must follow a code of conduct, and anyone can complain about a councillor or about a service to the Public Services Ombudsman for Wales.",
        ],
      },
      {
        id: "meetings",
        title: "How meetings work",
        paras: [
          "About a week before a meeting, the council publishes an agenda: the list of items, with a report for each one written by officers. Reports usually end with recommendations, which are what officers suggest councillors decide.",
          "At the meeting, councillors discuss each item and decide, often by voting. Most meetings are open to the public, and many are broadcast online. A few items are discussed in private when they involve confidential information, such as someone's personal details or a contract being negotiated. These are often called Part II or exempt items.",
          "Afterwards the council publishes minutes. The minutes are the official record of what was decided, usually written as 'RESOLVED that...'. They don't record everything that was said.",
        ],
      },
      {
        id: "interests",
        title: "Declarations of interest",
        paras: [
          "At the start of each meeting, councillors must say if they have an interest in anything on the agenda: for example a job, a property, a club they belong to, or a family member affected.",
          "A personal interest is one they must declare but which doesn't stop them taking part. A prejudicial interest is one a reasonable person would think strong enough to affect their judgement. A councillor with a prejudicial interest usually leaves the room for that item and takes no part in the decision, unless the council's standards committee has given them a dispensation.",
        ],
      },
      {
        id: "have-your-say",
        title: "Have your say",
        paras: [
          "Contact your councillors. They represent everyone in their ward, whether or not you voted for them. Find them with your postcode on OpenCouncils, then email or phone them. Say what the issue is, where, and what you would like them to do.",
          "Go to a meeting, or watch it. Meetings are listed on OpenCouncils and on the council's website, with the time and place. Every council must broadcast meetings of the full Council, and many also broadcast the Cabinet and planning committee.",
          "Speak at a planning committee. Most councils let people who support or object to a planning application speak at the committee meeting that decides it, if they register in advance. Check the council's website for the deadline.",
          "Ask a question or start a petition. Every Welsh council must have a petition scheme, and many let members of the public ask questions at full Council meetings. Each council must publish a public participation strategy explaining how people can take part.",
          "Respond to consultations. Councils consult on budgets, school changes, local plans and more. Consultations are listed on each council's website.",
          "If something has gone wrong, complain to the council first. If you're not satisfied with the answer, you can go to the Public Services Ombudsman for Wales.",
        ],
      },
    ],
    glossaryTitle: "Words councils use",
    glossaryLede: "What the terms in council papers mean.",
    glossary: [
      { id: "agenda", term: "Agenda", def: "The list of items to be discussed at a meeting, published about a week before, with reports attached." },
      { id: "minutes", term: "Minutes", def: "The official record of a meeting: who attended, interests declared and what was decided. Usually published a few weeks afterwards." },
      { id: "resolved", term: "Resolved", def: "The word minutes use for a decision: 'RESOLVED that the report be approved' means the meeting decided to approve it." },
      { id: "recommendation", term: "Recommendation", def: "What a report suggests councillors decide. Councillors can accept, change or reject it." },
      { id: "full-council", term: "Full Council", def: "A meeting of all the council's councillors. It sets the budget and council tax and makes the biggest decisions." },
      { id: "cabinet", term: "Cabinet", def: "The leader and a small group of senior councillors who make most major decisions. Sometimes called the executive." },
      { id: "leader", term: "Leader", def: "The councillor chosen by the full Council to lead it, usually from the largest party or group." },
      { id: "cabinet-member", term: "Cabinet member", def: "A councillor in the cabinet responsible for an area such as education, housing or finance. Sometimes called a portfolio holder." },
      { id: "scrutiny", term: "Scrutiny committee", def: "A committee of councillors outside the cabinet that examines the cabinet's decisions and how services are run, and makes recommendations." },
      { id: "call-in", term: "Call-in", def: "When scrutiny councillors ask for a cabinet decision to be reviewed before it takes effect." },
      { id: "officer", term: "Officer", def: "A member of council staff. Officers write reports, give advice and carry out decisions." },
      { id: "delegated", term: "Delegated decision", def: "A decision made by an officer or a single cabinet member under powers the council has given them, without a committee meeting." },
      { id: "part-ii", term: "Part II or exempt item", def: "An item discussed in private because it involves confidential information, such as personal details or commercial terms." },
      { id: "quorum", term: "Quorum", def: "The minimum number of councillors who must be present for a meeting to make decisions." },
      { id: "motion", term: "Motion", def: "A proposal put to a meeting for a decision. A notice of motion is one a councillor gives notice of in advance." },
      { id: "personal-interest", term: "Personal interest", def: "A link between a councillor and an agenda item that they must declare, but which doesn't stop them taking part." },
      { id: "prejudicial-interest", term: "Prejudicial interest", def: "An interest strong enough that the councillor should leave the room and take no part in that decision, unless the standards committee has given them a dispensation." },
      { id: "ward", term: "Ward", def: "The area a councillor is elected to represent. Larger wards elect two or more councillors." },
      { id: "ldp", term: "Local development plan", def: "The council's long-term plan for land use: where new homes, jobs and services can go." },
      { id: "s106", term: "Section 106 agreement", def: "An agreement with a developer to pay for or provide things a development needs, such as affordable homes, play areas or school places." },
      { id: "band-d", term: "Band D", def: "The middle council tax band, used to compare council tax between councils. Other bands pay a set fraction more or less." },
      { id: "revenue-capital", term: "Revenue and capital", def: "Revenue spending pays for running services day to day. Capital spending pays for things that last, such as buildings and roads." },
      { id: "ombudsman", term: "Public Services Ombudsman for Wales", def: "An independent office that investigates complaints about public services in Wales, and about councillors breaking the code of conduct." },
      { id: "community-council", term: "Community and town councils", def: "The smallest level of local government, covering a town or village. They are separate from the county or county borough council." },
      { id: "participation", term: "Public participation strategy", def: "A document every Welsh council must publish, setting out how people can find out about and take part in its decisions." },
    ],
    termLink: "What is this?",
  },
  cy: {
    title: "Sut mae cynghorau'n gweithio",
    lede: "Canllaw byr i gynghorau Cymru: beth maen nhw'n ei wneud, pwy sy'n penderfynu, sut mae cyfarfodydd yn gweithio, a sut gallwch chi ddweud eich dweud.",
    contents: "Ar y dudalen hon",
    sections: [
      {
        id: "what",
        title: "Beth mae eich cyngor yn ei wneud",
        paras: [
          "Mae gan Gymru 22 o gynghorau, a elwir weithiau'n awdurdodau lleol. Mae pob un yn rhedeg y rhan fwyaf o'r gwasanaethau cyhoeddus lleol yn ei ardal: ysgolion, gofal cymdeithasol i blant ac oedolion, casglu biniau ac ailgylchu, ffyrdd lleol a pharcio, cynllunio, tai a digartrefedd, llyfrgelloedd a hamdden, trwyddedu, ac iechyd yr amgylchedd.",
          "Mae eraill yn rhedeg rhai pethau. Byrddau iechyd sy'n rhedeg y GIG yng Nghymru. Llywodraeth Cymru sy'n gyfrifol am gefnffyrdd a thraffyrdd. Mae gan yr heddlu a'r gwasanaethau tân eu hawdurdodau eu hunain. Mewn parc cenedlaethol, awdurdod y parc cenedlaethol sy'n delio â chynllunio. Mae gan Gymru hefyd dros 700 o gynghorau cymuned a thref, sy'n llai ac ar wahân.",
          "Mae cynghorau'n cael eu hariannu'n bennaf gan arian gan Lywodraeth Cymru, a chan y dreth gyngor. Mae ardrethi busnes yn cael eu casglu gan gynghorau ond yn cael eu cronni ledled Cymru a'u rhannu gan Lywodraeth Cymru fel rhan o'r arian hwnnw.",
        ],
      },
      {
        id: "who",
        title: "Pwy sy'n penderfynu",
        paras: [
          "Caiff cynghorwyr eu hethol gan bobl pob ward i'w cynrychioli. Cynhelir etholiadau cynghorau Cymru bob pum mlynedd; bydd y nesaf ym mis Mai 2027. Gall pobl 16 oed a hŷn bleidleisio, gan gynnwys dinasyddion tramor sy'n byw yng Nghymru yn gyfreithlon.",
          "Mae pob cyngor yng Nghymru yn cael ei redeg gan arweinydd a chabinet. Mae'r cynghorwyr yn dewis arweinydd, fel arfer o'r blaid neu'r grŵp mwyaf. Mae'r arweinydd yn dewis cabinet o hyd at ddeg cynghorydd, pob un yn gyfrifol am faes fel addysg neu dai. Y cabinet sy'n gwneud y rhan fwyaf o'r penderfyniadau mawr o ddydd i ddydd.",
          "Mae'r holl gynghorwyr gyda'i gilydd yn ffurfio'r Cyngor llawn. Mae'n pennu'r gyllideb a'r dreth gyngor bob blwyddyn, yn cytuno ar brif gynlluniau'r cyngor a'i gyfansoddiad, ac yn dewis yr arweinydd.",
          "Mae staff y cyngor, a elwir yn swyddogion, yn rhoi cyngor, yn ysgrifennu'r adroddiadau y mae cynghorwyr yn eu darllen, ac yn gwneud llawer o benderfyniadau arferol eu hunain dan bwerau y mae'r cyngor yn eu rhoi iddyn nhw. Penderfyniadau dirprwyedig yw'r rhain.",
        ],
      },
      {
        id: "scrutiny",
        title: "Cadw golwg ar benderfyniadau",
        paras: [
          "Mae cynghorwyr nad ydyn nhw yn y cabinet yn eistedd ar bwyllgorau craffu. Mae'r rhain yn holi aelodau'r cabinet a swyddogion, yn edrych ar sut mae gwasanaethau'n gweithio, ac yn gwneud argymhellion. Os ydyn nhw'n credu bod penderfyniad y cabinet yn anghywir, gallan nhw ei alw i mewn cyn iddo ddod i rym a gofyn i'r cabinet ailystyried.",
          "Mae pwyllgor llywodraethu ac archwilio yn gwirio cyllid y cyngor a sut mae'n rheoli risg. Mae pwyllgor safonau yn delio ag ymddygiad cynghorwyr. Rhaid i gynghorwyr ddilyn cod ymddygiad, a gall unrhyw un gwyno am gynghorydd neu am wasanaeth i Ombwdsmon Gwasanaethau Cyhoeddus Cymru.",
        ],
      },
      {
        id: "meetings",
        title: "Sut mae cyfarfodydd yn gweithio",
        paras: [
          "Tua wythnos cyn cyfarfod, mae'r cyngor yn cyhoeddi agenda: y rhestr o eitemau, gydag adroddiad ar gyfer pob un wedi'i ysgrifennu gan swyddogion. Mae adroddiadau fel arfer yn gorffen gydag argymhellion, sef yr hyn y mae swyddogion yn awgrymu y dylai cynghorwyr ei benderfynu.",
          "Yn y cyfarfod, mae cynghorwyr yn trafod pob eitem ac yn penderfynu, yn aml drwy bleidleisio. Mae'r rhan fwyaf o gyfarfodydd yn agored i'r cyhoedd, a llawer yn cael eu darlledu ar-lein. Caiff ambell eitem ei thrafod yn breifat pan fydd yn ymwneud â gwybodaeth gyfrinachol, fel manylion personol rhywun neu gontract sy'n cael ei drafod. Gelwir y rhain yn aml yn eitemau Rhan II neu eitemau eithriedig.",
          "Wedyn mae'r cyngor yn cyhoeddi cofnodion. Y cofnodion yw'r cofnod swyddogol o'r hyn a benderfynwyd, wedi'i ysgrifennu fel arfer fel 'PENDERFYNWYD bod...'. Dydyn nhw ddim yn cofnodi popeth a ddywedwyd.",
        ],
      },
      {
        id: "interests",
        title: "Datganiadau o fuddiant",
        paras: [
          "Ar ddechrau pob cyfarfod, rhaid i gynghorwyr ddweud os oes ganddyn nhw fuddiant mewn unrhyw beth ar yr agenda: er enghraifft swydd, eiddo, clwb y maen nhw'n perthyn iddo, neu aelod o'r teulu y mae'n effeithio arno.",
          "Mae buddiant personol yn un y mae'n rhaid ei ddatgan ond nad yw'n eu hatal rhag cymryd rhan. Mae buddiant sy'n rhagfarnu yn un y byddai person rhesymol yn ei ystyried yn ddigon cryf i effeithio ar eu barn. Fel arfer bydd cynghorydd sydd â buddiant sy'n rhagfarnu yn gadael yr ystafell ar gyfer yr eitem honno ac yn peidio â chymryd rhan yn y penderfyniad, oni bai bod pwyllgor safonau'r cyngor wedi rhoi gollyngiad iddyn nhw.",
        ],
      },
      {
        id: "have-your-say",
        title: "Dweud eich dweud",
        paras: [
          "Cysylltwch â'ch cynghorwyr. Maen nhw'n cynrychioli pawb yn eu ward, p'un a wnaethoch chi bleidleisio drostyn nhw ai peidio. Dewch o hyd iddyn nhw gyda'ch cod post ar OpenCouncils, yna anfonwch e-bost neu ffoniwch. Dywedwch beth yw'r mater, ble, a beth hoffech chi iddyn nhw ei wneud.",
          "Ewch i gyfarfod, neu gwyliwch e. Mae cyfarfodydd wedi'u rhestru ar OpenCouncils ac ar wefan y cyngor, gyda'r amser a'r lle. Rhaid i bob cyngor ddarlledu cyfarfodydd y Cyngor llawn, ac mae llawer hefyd yn darlledu'r Cabinet a'r pwyllgor cynllunio.",
          "Siaradwch mewn pwyllgor cynllunio. Mae'r rhan fwyaf o gynghorau'n gadael i bobl sy'n cefnogi neu'n gwrthwynebu cais cynllunio siarad yng nghyfarfod y pwyllgor sy'n penderfynu arno, os ydyn nhw'n cofrestru ymlaen llaw. Edrychwch ar wefan y cyngor am y dyddiad cau.",
          "Gofynnwch gwestiwn neu ddechrau deiseb. Rhaid i bob cyngor yng Nghymru gael cynllun deisebau, ac mae llawer yn gadael i aelodau'r cyhoedd ofyn cwestiynau mewn cyfarfodydd o'r Cyngor llawn. Rhaid i bob cyngor gyhoeddi strategaeth cyfranogiad y cyhoedd yn esbonio sut gall pobl gymryd rhan.",
          "Ymatebwch i ymgynghoriadau. Mae cynghorau'n ymgynghori ar gyllidebau, newidiadau i ysgolion, cynlluniau lleol a mwy. Mae ymgynghoriadau wedi'u rhestru ar wefan pob cyngor.",
          "Os aeth rhywbeth o'i le, cwynwch wrth y cyngor yn gyntaf. Os nad ydych chi'n fodlon â'r ateb, gallwch fynd at Ombwdsmon Gwasanaethau Cyhoeddus Cymru.",
        ],
      },
    ],
    glossaryTitle: "Geiriau mae cynghorau'n eu defnyddio",
    glossaryLede: "Beth mae'r termau ym mhapurau'r cyngor yn ei olygu.",
    glossary: [
      { id: "agenda", term: "Agenda", def: "Y rhestr o eitemau i'w trafod mewn cyfarfod, wedi'i chyhoeddi tua wythnos ymlaen llaw, gydag adroddiadau ynghlwm." },
      { id: "minutes", term: "Cofnodion", def: "Y cofnod swyddogol o gyfarfod: pwy oedd yno, y buddiannau a ddatganwyd a'r hyn a benderfynwyd. Caiff eu cyhoeddi fel arfer ychydig wythnosau wedyn." },
      { id: "resolved", term: "Penderfynwyd", def: "Y gair y mae cofnodion yn ei ddefnyddio am benderfyniad: mae 'PENDERFYNWYD cymeradwyo'r adroddiad' yn golygu bod y cyfarfod wedi penderfynu ei gymeradwyo." },
      { id: "recommendation", term: "Argymhelliad", def: "Yr hyn y mae adroddiad yn awgrymu y dylai cynghorwyr ei benderfynu. Gall cynghorwyr ei dderbyn, ei newid neu ei wrthod." },
      { id: "full-council", term: "Cyngor llawn", def: "Cyfarfod o holl gynghorwyr y cyngor. Mae'n pennu'r gyllideb a'r dreth gyngor ac yn gwneud y penderfyniadau mwyaf." },
      { id: "cabinet", term: "Cabinet", def: "Yr arweinydd a grŵp bach o uwch gynghorwyr sy'n gwneud y rhan fwyaf o'r penderfyniadau mawr. Fe'i gelwir weithiau'n weithrediaeth." },
      { id: "leader", term: "Arweinydd", def: "Y cynghorydd a ddewisir gan y Cyngor llawn i'w arwain, fel arfer o'r blaid neu'r grŵp mwyaf." },
      { id: "cabinet-member", term: "Aelod cabinet", def: "Cynghorydd yn y cabinet sy'n gyfrifol am faes fel addysg, tai neu gyllid. Fe'i gelwir weithiau'n ddeiliad portffolio." },
      { id: "scrutiny", term: "Pwyllgor craffu", def: "Pwyllgor o gynghorwyr y tu allan i'r cabinet sy'n archwilio penderfyniadau'r cabinet a sut mae gwasanaethau'n cael eu rhedeg, ac yn gwneud argymhellion." },
      { id: "call-in", term: "Galw i mewn", def: "Pan fydd cynghorwyr craffu yn gofyn i benderfyniad cabinet gael ei adolygu cyn iddo ddod i rym." },
      { id: "officer", term: "Swyddog", def: "Aelod o staff y cyngor. Mae swyddogion yn ysgrifennu adroddiadau, yn rhoi cyngor ac yn gweithredu penderfyniadau." },
      { id: "delegated", term: "Penderfyniad dirprwyedig", def: "Penderfyniad a wneir gan swyddog neu un aelod cabinet dan bwerau y mae'r cyngor wedi'u rhoi iddyn nhw, heb gyfarfod pwyllgor." },
      { id: "part-ii", term: "Eitem Rhan II neu eitem eithriedig", def: "Eitem a drafodir yn breifat am ei bod yn ymwneud â gwybodaeth gyfrinachol, fel manylion personol neu delerau masnachol." },
      { id: "quorum", term: "Cworwm", def: "Y nifer lleiaf o gynghorwyr sy'n gorfod bod yn bresennol er mwyn i gyfarfod wneud penderfyniadau." },
      { id: "motion", term: "Cynnig", def: "Cynnig a roddir gerbron cyfarfod i'w benderfynu. Rhybudd o gynnig yw un y mae cynghorydd yn rhoi rhybudd ohono ymlaen llaw." },
      { id: "personal-interest", term: "Buddiant personol", def: "Cysylltiad rhwng cynghorydd ac eitem ar yr agenda y mae'n rhaid ei ddatgan, ond nad yw'n eu hatal rhag cymryd rhan." },
      { id: "prejudicial-interest", term: "Buddiant sy'n rhagfarnu", def: "Buddiant digon cryf fel y dylai'r cynghorydd adael yr ystafell a pheidio â chymryd rhan yn y penderfyniad hwnnw, oni bai bod y pwyllgor safonau wedi rhoi gollyngiad iddyn nhw." },
      { id: "ward", term: "Ward", def: "Yr ardal y caiff cynghorydd ei ethol i'w chynrychioli. Mae wardiau mwy yn ethol dau neu fwy o gynghorwyr." },
      { id: "ldp", term: "Cynllun datblygu lleol", def: "Cynllun hirdymor y cyngor ar gyfer defnydd tir: ble gall cartrefi, swyddi a gwasanaethau newydd fynd." },
      { id: "s106", term: "Cytundeb adran 106", def: "Cytundeb gyda datblygwr i dalu am neu ddarparu pethau sydd eu hangen ar ddatblygiad, fel cartrefi fforddiadwy, ardaloedd chwarae neu leoedd ysgol." },
      { id: "band-d", term: "Band D", def: "Y band treth gyngor canol, a ddefnyddir i gymharu'r dreth gyngor rhwng cynghorau. Mae bandiau eraill yn talu cyfran benodol yn fwy neu'n llai." },
      { id: "revenue-capital", term: "Refeniw a chyfalaf", def: "Mae gwariant refeniw yn talu am redeg gwasanaethau o ddydd i ddydd. Mae gwariant cyfalaf yn talu am bethau sy'n para, fel adeiladau a ffyrdd." },
      { id: "ombudsman", term: "Ombwdsmon Gwasanaethau Cyhoeddus Cymru", def: "Swyddfa annibynnol sy'n ymchwilio i gwynion am wasanaethau cyhoeddus yng Nghymru, ac am gynghorwyr sy'n torri'r cod ymddygiad." },
      { id: "community-council", term: "Cynghorau cymuned a thref", def: "Y lefel leiaf o lywodraeth leol, sy'n cwmpasu tref neu bentref. Maen nhw ar wahân i'r cyngor sir neu fwrdeistref sirol." },
      { id: "participation", term: "Strategaeth cyfranogiad y cyhoedd", def: "Dogfen y mae'n rhaid i bob cyngor yng Nghymru ei chyhoeddi, yn nodi sut gall pobl ddysgu am ei benderfyniadau a chymryd rhan ynddyn nhw." },
    ],
    termLink: "Beth yw hyn?",
  },
});
