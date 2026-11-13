# OpenCouncils: scope for a site covering every UK council

13 November 2026 · Owen Derbyshire · Decisions agreed 13 November 2026

## Summary

OpenCouncils (opencouncils.com) does for every principal council in the UK what opencouncil.wales does for the 22 Welsh councils: who runs each council, what it is deciding, how it is performing and what the watchdogs say, all in one consistent place.

Wales has 22 councils. The UK has around 370, and that number is moving because of English reorganisation. Covering every council in full would cost about 17 times as much as the Welsh site to run. The agreed approach:

- **Standalone site**, "Published by DC Group", seller Datblygu Cyf trading as DC Group, English only. No Edau feed at launch.
- **opencouncil.wales stays standalone.** OpenCouncils reuses its Welsh data.
- **Two levels of coverage.** Structured data for every council from launch. AI summaries only for monitored councils and the largest councils, capped at £60 a month.
- **Launch before the May 2027 elections**, with a reorganisation tracker as the second hook.
- **Same prices as the rest of the suite.**

## Decisions agreed

| # | Decision |
|---|---|
| 1 | Name OpenCouncils, domain opencouncils.com |
| 2 | opencouncil.wales stays standalone; OpenCouncils uses its data for Wales |
| 3 | Standalone, "Published by DC Group", no Edau feed at launch |
| 4 | Structured data for every council; AI summaries for monitored and largest councils only |
| 5 | UK summary cap £60 a month |
| 6 | Launch before the May 2027 elections |
| 7 | Combined and strategic authorities in phase two; planning and parish councils out for now |
| 8 | No approach to Open Council Data UK |
| 9 | Monitoring and briefing prices match the rest of the suite |
| 10 | Yellow accent colour |
| 11 | Own repo: opencouncils |

## The landscape

**Councils by nation**

| Nation | Principal councils | Notes |
|---|---|---|
| England | about 317 (21 counties, 164 districts, 132 unitaries) | Falls to about 307 when Surrey's 12 councils become East and West Surrey on 1 April 2027 |
| Scotland | 32 | All unitary |
| Wales | 22 | Data from opencouncil.wales |
| Northern Ireland | 11 | Narrower powers (no education or social care) |
| **Total** | **about 382 now, about 372 from April 2027** | |

Above these sit England's combined and strategic authorities, many with elected mayors (phase two). Below them sit more than 10,000 parish, town and community councils (out of scope).

**English reorganisation is unsettled.** In July 2026 the government confirmed reorganisation for 14 more two-tier areas, replacing 134 councils with 38 unitaries from April 2028. On 7 September 2026 it paused the programme for a rapid review after new legal advice, and withdrew four decisions (including Hampshire and Suffolk). Surrey goes ahead. May 2027 elections will be held on existing boundaries.

For the build, the data model treats councils as things that are created, merged and abolished, with a lineage from old councils to new ones.

**Elections in May 2027.** Scheduled council elections take place across Scotland, Wales and Northern Ireland, and in much of England. Spring 2027 is the launch window.

## Product shape

**Brand.** OpenCouncils, one word, in the family style. "Published by DC Group" linking to datblygu.cymru. Uses the shared Open site design with the pop-out sidebar. Accent colour is yellow (decided 13 November 2026). Yellow text on a light background is hard to read, so bright yellow is used for fills, map shading, chart highlights and the logo, with a deeper amber for links and text accents. Both are checked for contrast in light and dark modes.

**Relationship to opencouncil.wales.** Two separate sites. opencouncil.wales remains the Welsh product: bilingual, Edau-fed, with the five Welsh enrichments. OpenCouncils reads Welsh council data from it, so Wales is never collected twice. Light cross-links between the two.

**Engine.** Follows the shared-engine approach agreed for the parliament sites: one codebase, configured per nation. OpenCouncils is the multi-nation configuration. The Welsh OpenCouncil is proven first (Cardiff pilot, then all 22).

**Name clash.** Open Council Data UK (opencouncildata.co.uk) uses a similar name for council and councillor data. No approach planned. Its free data carries a share-alike licence, which would oblige OpenCouncils to release derived data on the same terms, so councils' own sites are the primary source instead.

## Scope and coverage

**Level 1: every principal council, from launch**

- Council profile: type, area, population, governance model (leader and cabinet, committee system, directly elected mayor)
- Political control and composition, with history
- Councillors by ward and party; leader, cabinet and portfolio holders
- Elections and by-elections, with results
- Meetings calendar and links to agendas, reports and minutes
- Headline finance: council tax, revenue spending by service, reserves
- Watchdog view: ombudsman decisions, audit and inspection reports, intervention status
- Reorganisation status and lineage

**Level 2: monitored and largest councils**

- AI summaries of cabinet and full council decisions
- Forward plans of upcoming key decisions
- Commissioned briefings and paid monitoring

**Phase two**

- Combined and strategic authorities, including mayors

**Out of scope for now**

- Parish, town and community councils
- Planning applications (link out instead)
- Fire, police and national park authorities

## Data sources

| Need | Main sources |
|---|---|
| Councils and boundaries | ONS geography codes, OS Boundary-Line, the four nations' boundary commissions |
| Composition and councillors | Councils' own committee systems and websites |
| Elections and candidates | Democracy Club (free CSVs and API, all UK council elections) |
| Meetings, decisions, forward plans | Council committee systems. Civica's Modern.Gov is the market leader and has a web service; CMIS and a handful of others cover most of the rest. One adapter per platform, not per council |
| Finance | England: government revenue outturn and council tax statistics. Scotland: local financial returns. Wales: via opencouncil.wales. Northern Ireland: Department for Communities |
| Watchdogs | England: Local Government and Social Care Ombudsman, external audit, Ofsted, CQC, government intervention notices. Scotland: Accounts Commission and Audit Scotland, SPSO. Northern Ireland: NI Audit Office, NIPSO. Wales: via opencouncil.wales |
| Reorganisation | MHCLG decisions and statutory instruments, council announcements |

The first engineering job is a census of which committee platform each council uses and whether its feed works. That decides how quickly meetings and councillor data reach full coverage.

Accuracy rules carry over from the Welsh site: every figure sourced and dated, third-party data cited and never presented as our own, automated safeguards rather than manual sign-off of everything. Composition is checked against two independent sources (council sites and Democracy Club results plus by-elections) before publishing.

## Features

**At launch**

- Council pages
- UK map of political control, filterable by nation and council type
- Compare: one issue across councils (for example, council tax rises or reserves), with tables and charts
- Who holds what: every cabinet member for a given portfolio across the UK, such as all adult social care leads
- Elections hub for May 2027, with by-elections tracked year round
- Reorganisation tracker: which councils are going, what replaces them, timetable and status since the September pause
- Free alerts and a free weekly email

**After launch**

- Decision summaries and forward plans for more councils as demand grows
- Combined and strategic authorities
- Topic pages that follow one issue across councils

## Business model

The English market is much larger than Wales: national public affairs agencies, suppliers bidding for council contracts, trade bodies, charities, and journalists covering local government.

- Core site free and open
- Paid monitors at £25 a month per council or topic, weekly or monthly briefings
- Commissioned briefings at £10, or £50 for six
- Later: a data feed or API for agencies

A council gets AI decision summaries once someone is monitoring it, which ties running cost to revenue.

## Costs, phasing and risks

**Running costs.** Level 1 is scheduled data collection on Hetzner, at low cost. AI summaries are capped at £60 a month, spent on monitored councils first, then the largest councils by population.

**Phasing**

1. Prove the Welsh OpenCouncil on the engine (Cardiff pilot, then all 22)
2. Council register, lineage, composition, councillors, elections and finance for every UK council
3. Committee platform census and adapters; meetings data for all councils
4. Paid monitors, summaries on demand, briefings
5. Launch ahead of May 2027 elections
6. Combined and strategic authorities, forward plans at scale, topic pages

**Risks**

- **Accuracy at scale.** Around 370 sources, all changing. Two-source checks and adapter health alerts from the start.
- **Reorganisation churn.** Decisions may change again after the review. The lineage model handles this; the tracker needs regular checking.
- **Scraping fragility.** Council sites change without notice.
- **Cost creep.** Held by the £60 cap and demand-led coverage.

## Still open

- **Domain.** opencouncils.com is not yet bought. There is something already at the address, so its availability and price need checking before purchase.
- **Infrastructure:** opencouncils repo set up (13 November 2026). Vercel project and Neon database still to create, following the OpenWestminster set-up.
