/**
 * A short primer for each topic: what councils do about it, who decides, and
 * how someone can have a say. Shown at the top of each topic page.
 */
import { defineMessages } from "../server";

type Primer = { what: string; who: string; say: string };

export const topicGuide = defineMessages<{
  whatTitle: string;
  whoTitle: string;
  sayTitle: string;
  numbersTitle: string;
  spendLine: string;
  spendRange: string;
  measureLine: string;
  moreMeasures: string;
  league: string;
  primers: Record<string, Primer>;
}>({
  en: {
    whatTitle: "What councils do",
    whoTitle: "Who decides",
    sayTitle: "Having a say",
    numbersTitle: "In numbers",
    spendLine: "Welsh councils plan to spend **{wales}** per person on this in {year}.",
    spendRange: "It ranges from {low} in {lowName} to {high} in {highName}.",
    measureLine: "{name}: **{value}** across Wales ({period}).",
    moreMeasures: "How each council is doing",
    league: "Planning decisions by authority",
    primers: {
      budget: {
        what: "Each council sets a budget every year: how much to spend on each service and how much council tax to charge. Council tax pays for about a third; most of the rest is a grant from the Welsh Government and business rates.",
        who: "The Cabinet proposes the budget, usually in the winter, and the full Council agrees it and sets council tax by early March. Scrutiny committees examine the plans first.",
        say: "Most councils run a budget consultation in the autumn or early winter. Your councillors vote on the final budget, so tell them what matters to you.",
      },
      housing: {
        what: "Councils must help people who are homeless or about to lose their home, find temporary places to stay, and plan for new affordable homes. Some councils own and manage council housing; in others, housing associations do.",
        who: "The Cabinet member for housing leads, with big decisions at Cabinet. Housing plans and rent levels for council homes go to the Cabinet or full Council.",
        say: "If you're at risk of losing your home, contact the council's housing options team as early as possible: the law says it must help. For wider issues, contact your councillors.",
      },
      schools: {
        what: "Councils run community schools, fund every state school, provide school transport and support pupils with additional learning needs. They plan school places, including Welsh-medium places under a ten-year plan.",
        who: "The Cabinet decides on school changes, such as opening, closing or merging schools, after a formal consultation. Head teachers and governing bodies run each school day to day.",
        say: "Proposals to change a school must be consulted on, and anyone can respond. Parents can also become school governors.",
      },
      planning: {
        what: "Councils decide planning applications for new buildings, extensions and changes of use, and write the local development plan that says where new homes and jobs can go. National parks decide applications inside their boundaries.",
        who: "Planning officers decide most applications. Larger or disputed ones go to the planning committee of councillors, which meets in public.",
        say: "Anyone can comment on an application while it's open, usually for 21 days. Stick to planning matters such as traffic, design, noise and overlooking.",
      },
      "social-care": {
        what: "Councils arrange care and support for older people, disabled adults and carers, protect children and adults at risk, and look after children in care. Much care is provided by private and charity providers the council pays.",
        who: "The Cabinet member for social services leads, and each council has a statutory Director of Social Services. Scrutiny committees examine how services are doing.",
        say: "Anyone can ask the council for an assessment of their care needs, or of their needs as a carer. If you're worried about someone's safety, contact the council's safeguarding team.",
      },
      transport: {
        what: "Councils look after local roads and pavements, street lights, parking and road safety, and support bus services that wouldn't run otherwise. Motorways and trunk roads are the Welsh Government's.",
        who: "The Cabinet member for transport leads. Traffic orders, such as new speed limits or parking restrictions, are advertised before they're made.",
        say: "Report potholes and broken street lights to the council or through FixMyStreet. You can object to a proposed traffic order during its notice period.",
      },
      waste: {
        what: "Councils collect household waste and recycling, run recycling centres, keep streets clean and deal with fly-tipping.",
        who: "The Cabinet member for the environment leads. Changes to collections usually go to the Cabinet.",
        say: "Report missed collections and fly-tipping to the council. Changes to collection services are often consulted on first.",
      },
      climate: {
        what: "Every Welsh council has declared or responded to the climate emergency and has plans to cut its own emissions, from buildings, vehicles and the things it buys. Councils also manage flood risk on local rivers and streams.",
        who: "The Cabinet agrees climate plans; scrutiny committees check progress.",
        say: "Ask your councillors how the council is doing against its own targets, and respond to its consultations on plans.",
      },
      economy: {
        what: "Councils support local businesses, regenerate town centres, run markets and apply for regeneration funding. They work with neighbouring councils through regional bodies called corporate joint committees.",
        who: "The Cabinet member for the economy leads. Big projects go to the Cabinet, and regional ones to the corporate joint committee.",
        say: "Business owners can contact the council's business support team. Regeneration plans are usually consulted on.",
      },
      "leisure-culture": {
        what: "Councils run or fund libraries, leisure centres, parks, museums and arts venues, often through a trust or company they set up.",
        who: "The Cabinet decides on opening hours, charges and closures, often after consultation.",
        say: "Proposals to close or change libraries and leisure centres are usually consulted on. Community groups can sometimes take over buildings the council no longer needs.",
      },
      "community-safety": {
        what: "Councils work with the police and others on community safety, run CCTV, license pubs, taxis and gambling premises, and deal with antisocial behaviour such as noise.",
        who: "Licensing decisions are made by a licensing committee or sub-committee of councillors, which hears from applicants and objectors.",
        say: "You can object to a licence application during its consultation period. Report noise and antisocial behaviour to the council.",
      },
      "council-running": {
        what: "How the council itself is run: its constitution, staff, buildings, IT, complaints, and how councillors behave.",
        who: "The full Council agrees the constitution. A standards committee deals with councillors' conduct; the Public Services Ombudsman for Wales investigates complaints.",
        say: "Complain to the council first; if you're not satisfied, you can go to the Ombudsman. Council meetings are public, and many are broadcast.",
      },
    },
  },
  cy: {
    whatTitle: "Beth mae cynghorau'n ei wneud",
    whoTitle: "Pwy sy'n penderfynu",
    sayTitle: "Dweud eich dweud",
    numbersTitle: "Mewn rhifau",
    spendLine: "Mae cynghorau Cymru yn bwriadu gwario **{wales}** y pen ar hyn yn {year}.",
    spendRange: "Mae'n amrywio o {low} yn {lowName} i {high} yn {highName}.",
    measureLine: "{name}: **{value}** ar draws Cymru ({period}).",
    moreMeasures: "Sut mae pob cyngor yn gwneud",
    league: "Penderfyniadau cynllunio fesul awdurdod",
    primers: {
      budget: {
        what: "Mae pob cyngor yn pennu cyllideb bob blwyddyn: faint i'w wario ar bob gwasanaeth a faint o dreth gyngor i'w chodi. Mae'r dreth gyngor yn talu am tua thraean; daw'r rhan fwyaf o'r gweddill o grant gan Lywodraeth Cymru ac ardrethi busnes.",
        who: "Mae'r Cabinet yn cynnig y gyllideb, fel arfer yn y gaeaf, ac mae'r Cyngor llawn yn ei chytuno ac yn pennu'r dreth gyngor erbyn dechrau mis Mawrth. Mae pwyllgorau craffu'n archwilio'r cynlluniau yn gyntaf.",
        say: "Mae'r rhan fwyaf o gynghorau'n cynnal ymgynghoriad ar y gyllideb yn yr hydref neu ddechrau'r gaeaf. Mae eich cynghorwyr yn pleidleisio ar y gyllideb derfynol, felly dywedwch wrthyn nhw beth sy'n bwysig i chi.",
      },
      housing: {
        what: "Rhaid i gynghorau helpu pobl sy'n ddigartref neu ar fin colli eu cartref, dod o hyd i leoedd dros dro i aros, a chynllunio ar gyfer cartrefi fforddiadwy newydd. Mae rhai cynghorau'n berchen ar dai cyngor ac yn eu rheoli; mewn eraill, cymdeithasau tai sy'n gwneud hynny.",
        who: "Yr aelod Cabinet dros dai sy'n arwain, gyda phenderfyniadau mawr yn y Cabinet. Mae cynlluniau tai a lefelau rhent tai cyngor yn mynd i'r Cabinet neu'r Cyngor llawn.",
        say: "Os ydych mewn perygl o golli eich cartref, cysylltwch â thîm opsiynau tai'r cyngor cyn gynted â phosibl: mae'r gyfraith yn dweud bod rhaid iddo helpu. Ar gyfer materion ehangach, cysylltwch â'ch cynghorwyr.",
      },
      schools: {
        what: "Mae cynghorau'n rhedeg ysgolion cymunedol, yn ariannu pob ysgol wladol, yn darparu cludiant i'r ysgol ac yn cefnogi disgyblion ag anghenion dysgu ychwanegol. Maen nhw'n cynllunio lleoedd ysgol, gan gynnwys lleoedd cyfrwng Cymraeg o dan gynllun deng mlynedd.",
        who: "Mae'r Cabinet yn penderfynu ar newidiadau i ysgolion, fel agor, cau neu uno ysgolion, ar ôl ymgynghoriad ffurfiol. Penaethiaid a chyrff llywodraethu sy'n rhedeg pob ysgol o ddydd i ddydd.",
        say: "Rhaid ymgynghori ar gynigion i newid ysgol, a gall unrhyw un ymateb. Gall rhieni hefyd ddod yn llywodraethwyr ysgol.",
      },
      planning: {
        what: "Mae cynghorau'n penderfynu ar geisiadau cynllunio ar gyfer adeiladau newydd, estyniadau a newidiadau defnydd, ac yn ysgrifennu'r cynllun datblygu lleol sy'n dweud ble gall cartrefi a swyddi newydd fynd. Mae parciau cenedlaethol yn penderfynu ar geisiadau o fewn eu ffiniau.",
        who: "Swyddogion cynllunio sy'n penderfynu ar y rhan fwyaf o geisiadau. Mae rhai mwy neu ddadleuol yn mynd i bwyllgor cynllunio'r cynghorwyr, sy'n cyfarfod yn gyhoeddus.",
        say: "Gall unrhyw un roi sylwadau ar gais tra ei fod ar agor, fel arfer am 21 diwrnod. Cadwch at faterion cynllunio fel traffig, dyluniad, sŵn ac edrych dros eiddo.",
      },
      "social-care": {
        what: "Mae cynghorau'n trefnu gofal a chymorth i bobl hŷn, oedolion anabl a gofalwyr, yn amddiffyn plant ac oedolion sydd mewn perygl, ac yn gofalu am blant mewn gofal. Mae llawer o ofal yn cael ei ddarparu gan ddarparwyr preifat ac elusennol y mae'r cyngor yn eu talu.",
        who: "Yr aelod Cabinet dros wasanaethau cymdeithasol sy'n arwain, ac mae gan bob cyngor Gyfarwyddwr Gwasanaethau Cymdeithasol statudol. Mae pwyllgorau craffu'n archwilio sut mae gwasanaethau'n gwneud.",
        say: "Gall unrhyw un ofyn i'r cyngor asesu eu hanghenion gofal, neu eu hanghenion fel gofalwr. Os ydych yn poeni am ddiogelwch rhywun, cysylltwch â thîm diogelu'r cyngor.",
      },
      transport: {
        what: "Mae cynghorau'n gofalu am ffyrdd a phalmentydd lleol, goleuadau stryd, parcio a diogelwch ar y ffyrdd, ac yn cefnogi gwasanaethau bws na fyddai'n rhedeg fel arall. Llywodraeth Cymru sy'n gyfrifol am draffyrdd a chefnffyrdd.",
        who: "Yr aelod Cabinet dros drafnidiaeth sy'n arwain. Mae gorchmynion traffig, fel terfynau cyflymder newydd neu gyfyngiadau parcio, yn cael eu hysbysebu cyn eu gwneud.",
        say: "Rhowch wybod am dyllau yn y ffordd a goleuadau stryd wedi torri i'r cyngor neu drwy FixMyStreet. Gallwch wrthwynebu gorchymyn traffig arfaethedig yn ystod ei gyfnod hysbysu.",
      },
      waste: {
        what: "Mae cynghorau'n casglu gwastraff ac ailgylchu o'r cartref, yn rhedeg canolfannau ailgylchu, yn cadw strydoedd yn lân ac yn delio â thipio anghyfreithlon.",
        who: "Yr aelod Cabinet dros yr amgylchedd sy'n arwain. Mae newidiadau i gasgliadau fel arfer yn mynd i'r Cabinet.",
        say: "Rhowch wybod i'r cyngor am gasgliadau a fethwyd a thipio anghyfreithlon. Yn aml, ymgynghorir ar newidiadau i wasanaethau casglu yn gyntaf.",
      },
      climate: {
        what: "Mae pob cyngor yng Nghymru wedi datgan neu ymateb i'r argyfwng hinsawdd ac mae ganddo gynlluniau i dorri ei allyriadau ei hun, o adeiladau, cerbydau a'r hyn y mae'n ei brynu. Mae cynghorau hefyd yn rheoli perygl llifogydd ar afonydd a nentydd lleol.",
        who: "Mae'r Cabinet yn cytuno ar gynlluniau hinsawdd; mae pwyllgorau craffu'n gwirio cynnydd.",
        say: "Gofynnwch i'ch cynghorwyr sut mae'r cyngor yn gwneud yn erbyn ei dargedau ei hun, ac ymatebwch i'w ymgynghoriadau ar gynlluniau.",
      },
      economy: {
        what: "Mae cynghorau'n cefnogi busnesau lleol, yn adfywio canol trefi, yn rhedeg marchnadoedd ac yn gwneud cais am gyllid adfywio. Maen nhw'n gweithio gyda chynghorau cyfagos drwy gyrff rhanbarthol o'r enw cyd-bwyllgorau corfforedig.",
        who: "Yr aelod Cabinet dros yr economi sy'n arwain. Mae prosiectau mawr yn mynd i'r Cabinet, a rhai rhanbarthol i'r cyd-bwyllgor corfforedig.",
        say: "Gall perchnogion busnes gysylltu â thîm cymorth busnes y cyngor. Fel arfer, ymgynghorir ar gynlluniau adfywio.",
      },
      "leisure-culture": {
        what: "Mae cynghorau'n rhedeg neu'n ariannu llyfrgelloedd, canolfannau hamdden, parciau, amgueddfeydd a lleoliadau celfyddydol, yn aml drwy ymddiriedolaeth neu gwmni a sefydlwyd ganddyn nhw.",
        who: "Mae'r Cabinet yn penderfynu ar oriau agor, ffioedd a chau, yn aml ar ôl ymgynghori.",
        say: "Fel arfer, ymgynghorir ar gynigion i gau neu newid llyfrgelloedd a chanolfannau hamdden. Weithiau gall grwpiau cymunedol gymryd drosodd adeiladau nad oes eu hangen ar y cyngor mwyach.",
      },
      "community-safety": {
        what: "Mae cynghorau'n gweithio gyda'r heddlu ac eraill ar ddiogelwch cymunedol, yn rhedeg teledu cylch cyfyng, yn trwyddedu tafarndai, tacsis a mangreoedd gamblo, ac yn delio ag ymddygiad gwrthgymdeithasol fel sŵn.",
        who: "Mae penderfyniadau trwyddedu'n cael eu gwneud gan bwyllgor neu is-bwyllgor trwyddedu o gynghorwyr, sy'n clywed gan ymgeiswyr a gwrthwynebwyr.",
        say: "Gallwch wrthwynebu cais am drwydded yn ystod ei gyfnod ymgynghori. Rhowch wybod i'r cyngor am sŵn ac ymddygiad gwrthgymdeithasol.",
      },
      "council-running": {
        what: "Sut mae'r cyngor ei hun yn cael ei redeg: ei gyfansoddiad, staff, adeiladau, TG, cwynion, a sut mae cynghorwyr yn ymddwyn.",
        who: "Mae'r Cyngor llawn yn cytuno ar y cyfansoddiad. Mae pwyllgor safonau'n delio ag ymddygiad cynghorwyr; mae Ombwdsmon Gwasanaethau Cyhoeddus Cymru yn ymchwilio i gwynion.",
        say: "Cwynwch i'r cyngor yn gyntaf; os nad ydych yn fodlon, gallwch fynd at yr Ombwdsmon. Mae cyfarfodydd y cyngor yn gyhoeddus, ac mae llawer yn cael eu darlledu.",
      },
    },
  },
});
