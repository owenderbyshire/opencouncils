# The Open family: shared design

OpenSenedd, OpenCouncil, OpenCharity and OpenEconomy are four free sites from Datblygu Cymru. They look and work as one family. OpenSenedd is the reference: when this file and OpenSenedd differ, follow OpenSenedd and update this file. Edau, the paid platform beneath them, keeps its own look and is credited only in the family footer.

Agreed with Owen on 5 November 2026:
- One look across all four, taken from OpenSenedd.
- One accent colour per site.
- OpenEconomy opens in light mode, with dark mode following the device.
- OpenEconomy's sidebar becomes the navigation of OpenCouncil and OpenCharity too. OpenSenedd keeps its own navigation.

## Principles

- Colourless chrome. Backgrounds, rules, text and controls are greys from the shared tokens. Colour appears only where it carries meaning: the site's accent, data marks in charts and maps, and semantic states.
- One accent per site, at the same lightness and strength as the others, so the four read as a set. The accent marks the logo, map areas, illustrations, the highlighted figure in a chart and the active navigation item. It is never used for body text or for large areas.
- Light by default, whatever the device says. Every site has a light and dark switch in the same place (the foot of the sidebar, or OpenSenedd's header). It remembers the reader's choice in localStorage, with a small inline script before first paint so pages never flash. Both modes use the tokens below.
- Graphic, never plain. Each site carries signature data graphics and subtle colour, in the spirit of OpenSenedd's coloured chamber diagram: real data drawn as pictures, in party colours, the accent and the shared data palette. See "Graphics and imagery".
- Plain language, British English, bilingual everywhere, short active sentences. No em dashes, no "not X but Y", no signposting, no marketing tone.
- Avoid all-caps labels, eyebrow labels, middle-dot metadata, arrows on links, decorative gradients or shadows, and identical card grids.
- Accessibility: one `h1` per page; colour is never the only signal; everything reachable by keyboard; text contrast at least 4.5:1.

## Tokens

### Shared greys (all four sites)

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#ffffff` | `#12181e` |
| `--surface` | `#f3f5f7` | `#1a222a` |
| `--surface-2` | `#e9edf1` | as each site has it now |
| `--rule` | `#dce2e7` | as each site has it now |
| `--rule-strong` | `#c3ccd4` | as each site has it now |
| `--ink` | `#1c2630` | as each site has it now |
| `--ink-2` | `#475563` | as each site has it now |
| `--ink-3` | `#5f6c79` | as each site has it now |
| `--mark` | `#fff3bf` | `#5a4a12` |
| `--focus` | `#1c2630` | `#e8edf1` |

Take the dark values from OpenCouncil's `src/app/globals.css`, which copied OpenSenedd's.

### Accents (one per site)

All four accents sit at the same lightness and strength (OKLCH about L 0.47, C 0.09 in light mode; L 0.71, C 0.11 in dark mode).

| Site | `--accent` light | `--accent-soft` light | `--accent` dark | `--accent-soft` dark | `--accent-ink` dark |
|---|---|---|---|---|---|
| OpenSenedd (teal, unchanged) | `#0d6b5e` | `#d3e9e3` | `#4fb7a3` | `#1d3a35` | `#0b1a17` |
| OpenCouncil (blue) | `#355d91` | `#d8e4f4` | `#6fa5ea` | `#273546` | `#101721` |
| OpenCharity (berry) | `#85445f` | `#f2dde4` | `#db83a6` | `#432c35` | `#1f1317` |
| OpenEconomy (violet) | `#664c90` | `#e6dff5` | `#ae91e2` | `#372f45` | `#181420` |

`--accent-ink` is `#ffffff` in light mode on all four sites.

Every accent passes 6:1 against white in light mode and 6.5:1 against `--bg` in dark mode.

### Data colours

- **A highlight against context.** One series in the accent; the rest in `--data-context`, using OpenCouncil's values (`#8592a0` light, `#6f7c88` dark).
- **Categories.** When a chart needs categories, use one shared categorical palette, in this order and never more than six colours: `#2a78d6`, `#d55e00`, `#009e73`, `#cc79a7`, `#e6a700`, `#56b4e9`.
- **Sequential maps.** A sequential ramp of the site's accent, from `--accent-soft` to `--accent`.
- **Semantic.** Good and bad use `--vote-for` and `--vote-against`, with OpenCouncil's values (`#2f6f4f` and `#a23b3b` light; `#5fb08a` and `#e07a7a` dark). Use them only where the data means good or bad. Never use them for decoration.
- **Party colours.** On data marks only.

## Graphics and imagery

Owen wants more graphic elements, imagery and subtle colour on every site. OpenSenedd's coloured chamber diagram is the model: it shows real data, in colour, at a glance.

- **Signature graphics, drawn from real data.** Each site has a few large data pictures that make its subject visible. Examples:
  - **OpenCouncil:** a chamber or seat diagram for each council (a hemicycle or block of dots, one per councillor, coloured by party or group, with a legend and counts in words). Plus a Wales map of councils shaded by the controlling group or an activity measure, and small chamber thumbnails in council lists.
  - **OpenCharity:** a Wales map of charities by area, causes as a set of simple line icons with counts, and income bands drawn as a bar.
  - **OpenEconomy:** keeps its charts and maps, in the family palette.
- **Subtle colour.**
  - Hero bands and section intros may sit on `--accent-soft`, and key figures may carry a thin accent rule above them (2px, as on OpenCouncil's and OpenCharity's home pages; OpenSenedd's figures sit under a grey rule because its chrome has no accent).
  - Party colours appear in data marks.
  - Illustrations use the accent with the grey tokens.
  - Never gradients, never shadows, never large blocks of saturated colour.
- **Icons.** One line icon set across all four, 1.5px stroke, in `--ink-2` or the accent. Use them to mark sections and kinds of record, never as decoration only.
- **Rules that still hold.**
  - Every picture states its numbers in words (a caption or `aria-label`), so colour is never the only signal.
  - Graphics show only figures the site holds. Missing data is shown as a gap.
  - Graphics work in light and dark mode.

## Type

- Headings: Newsreader (`@fontsource-variable/newsreader`, the `opsz` axis), weight 500 to 600. Long reading text uses the `.prose-read` measure.
- Interface, data and body: IBM Plex Sans (`@fontsource-variable/ibm-plex-sans`). Tabular figures (`tabular-nums`) in tables and counts.
- No other display faces. Sora, Inter and Playfair Display are not used on the Open sites. Playfair belongs to Edau's wordmark.

## Identity

- Wordmark: the site's name in Newsreader 600, in `--ink`. The names are OpenSenedd, OpenCouncil, OpenCharity and OpenEconomy in both languages. Product names are never translated: no "Cyngor Agored" or "Elusen Agored" anywhere, including page titles, metadata and footers.
- **Logo.** A rounded tile in the site's accent, holding the site's picture in `--accent-ink`. That's white in light mode and the dark accent-ink in dark mode. The pictures are:
  - OpenSenedd: the chamber, as two rows of seats.
  - OpenCouncil: a civic building.
  - OpenCharity: a heart made of two crossing threads.
  - OpenEconomy: rising bars with a line across them.

  The exact SVG for each, inline and as a favicon, is in `docs/tile-logos.md`. The tile is drawn on a 48-unit grid with corner radius 12, and the picture sits 8 units in.
- **Lockup.** The tile and the wordmark sit on one line, centred on each other, so every site's logo is the same height:
  - Sidebar: tile 36px, wordmark 24px, 10px apart.
  - Top bar and phone: tile 28px, wordmark 18px, 8px apart.
- **Tagline.** Never beside the tile. It sits on its own line under the lockup, aligned with the tile's left edge, in `--ink-3`, `text-meta`. Where it is longer than the sidebar, as OpenCouncil's Welsh line is, it wraps to a second line with the lines balanced (`text-wrap: balance`) rather than losing words to an ellipsis. Top bars leave it out.
- **Favicon.** The tile SVG in light colours.

## Layout

### OpenSenedd

Keeps its header, top navigation and page layout.

### OpenCouncil, OpenCharity and OpenEconomy: the dashboard sidebar

This is the pattern from OpenEconomy (`artifacts/weo/src/components/layout.tsx`):

- **Wide screens (from `lg`):** a fixed left sidebar 16rem wide.
  - **Top:** the wordmark block, as in Identity above.
  - **Middle:** the navigation in labelled sections, each with a small `text-meta` heading in `--ink-3` written in sentence case (never capitals). Each item has its line icon (18px, `--ink-3`, the accent when current) before the label. The active item has `--surface-2` behind it and a 2px left border in the accent.
  - **Bottom:** account or sign-in where the site has accounts, the language switch as a plain text link (as in OpenSenedd's header) and, where present, the theme switch as a quiet button.
  - **Styling:** `--bg` background, right border `--rule`. The sidebar scrolls on its own; the page scrolls separately.
- **Narrow screens:** a top bar 56px high with a menu button, the wordmark and search. The menu button opens the same sidebar as a drawer from the left, at most 85vw wide, over a scrim at 60% black.
  - The drawer has a close button and closes on Escape and when the scrim is tapped.
  - Focus moves into the drawer when it opens and returns to the menu button when it closes.
  - It carries `aria-modal` and a label.
- **Top bar on wide screens:** search on the left; language, theme and account on the right where they aren't in the sidebar.
- **Content:** a single column up to 72rem wide, `p-4 md:p-6 lg:p-8`. Pages keep their own internal structure.
- **Links:** every link stays a real link. Navigation works without JavaScript. On narrow screens without JavaScript, the menu button is a link to an anchored list of the same items at the foot of the page.

## Components

Use the same names and look on every site:

- `.rows`: lists separated by rules.
- `.data-table`: tables with `--rule-strong` header rules, `--rule` row rules and no zebra stripes.
- `.chip`: filter links, so every view has a URL. A current chip shows as `--ink` on `--bg`, with `aria-current`.
- `.prose-read`: long reading text.
- Buttons: a solid button in `--ink` with `--bg` text for the main action; a quiet button with a `--rule-strong` border. No coloured buttons except an accent-filled one for the single main action on a landing page.
- Cards: avoid them. Group content with headings and rules. Where a box is needed, it gets a `--rule` border and `--surface` background, square-ish corners (6px), and no shadow.

## Cross-promotion

### The family footer

Identical on all four sites, built from one data list. It is the last block of the footer, below the site's own lines and links, which start with the lockup (tile 28px and the wordmark in `text-h4`).

- A heading, "Part of the Edau family" / "Rhan o deulu Edau", in Plex Sans `text-small` semibold.
- Each site's name in semibold `--ink`, with its line beneath in the footer's `text-small` `--ink-2`, in two to four columns as the width allows.
- All four sites in a fixed order: OpenSenedd, OpenCouncil, OpenCharity, OpenEconomy. Each has its one-line description from the table below. The current site is in bold and unlinked.
- On Welsh pages, links go to the Welsh version of each site where it has one. OpenEconomy's Welsh pages are at `/cy` too.
- A line: "Data from Edau, Datblygu Cymru's store of Welsh public data." / "Data o Edau, storfa data cyhoeddus Cymru Datblygu Cymru." It links to https://edau.wales. This is the only place an Open site links to Edau.
- The publisher, Datblygu Cymru, with its link.

| Site | Address | English line | Welsh line |
|---|---|---|---|
| OpenSenedd | https://opensenedd.com | What the Senedd debates and decides | Beth mae'r Senedd yn ei drafod a'i benderfynu |
| OpenCouncil | https://opencouncil.wales | What Wales's 22 councils decide | Beth mae 22 cyngor Cymru yn ei benderfynu |
| OpenCharity | https://opencharity.wales | Every charity in Wales | Pob elusen yng Nghymru |
| OpenEconomy | https://openeconomy.wales | The Welsh economy in figures | Economi Cymru mewn ffigurau |

### "Elsewhere" links

Where a page is about something a sibling site also covers, it links there in an "Elsewhere in the Edau family" / "Mewn mannau eraill yn nheulu Edau" block. The block sits at the foot of the page's main column, as a `.rows` list. Each line names the sibling site and what the reader will find, for example "OpenEconomy: Cardiff's economy in figures". Links never have arrows.

| From | To |
|---|---|
| A council (OpenCouncil) | OpenEconomy's profile of that council area; OpenSenedd's constituencies covering it; OpenCharity's charities in that area |
| A Senedd constituency (OpenSenedd) | OpenCouncil's councils in it |
| A charity (OpenCharity) | Its council and Senedd mentions on OpenCouncil and OpenSenedd, where they exist |
| A council area (OpenEconomy) | OpenCouncil's council page; OpenCharity's area page |
| A company (OpenEconomy) | Nothing until a sibling covers companies |

Only link to a page that exists. Leave a line out rather than point at an empty page.

### Old addresses

No site links to localrecord.wales or getcambria.app. Use https://opencouncil.wales and https://openeconomy.wales, including in links built from data, emails, feeds and metadata. API base URLs used for data are configuration, not links. Where one still points at an old host, move it to the new host when that host serves the API.

## Changing this file

The same file lives in each Open repo at `docs/family-design.md`. Change all copies together, and tell Owen when OpenSenedd needs a matching change.
