/**
 * The site's navigation: the sidebar on wide screens, the drawer on phones,
 * and the list at the foot of the page that phones use without JavaScript.
 * Sections follow docs/family-design.md: a short sentence-case heading each.
 */
import { defineMessages } from "../server";

type Item = { path: string; label: string };
type Section = { id: string; label: string; items: Item[] };

export const navMessages = defineMessages<{
  menu: string;
  close: string;
  siteMenu: string;
  search: string;
  darkMode: string;
  sections: Section[];
}>({
  en: {
    menu: "Menu",
    close: "Close menu",
    siteMenu: "Site menu",
    search: "Search",
    darkMode: "Dark mode",
    sections: [
      {
        id: "councils",
        label: "Councils",
        items: [
          { path: "/councils", label: "All UK councils" },
          { path: "/find", label: "Find your councillors" },
          { path: "/reorganisation", label: "Councils being reorganised" },
          { path: "/compare", label: "Compare councils" },
        ],
      },
      {
        id: "decisions",
        label: "Decisions",
        items: [
          { path: "/latest", label: "Latest business" },
          { path: "/topics", label: "Topics" },
          { path: "/search", label: "Search" },
        ],
      },
      {
        id: "say",
        label: "Follow",
        items: [
          { path: "/follow", label: "Alerts and weekly email" },
          { path: "/guide", label: "How councils work" },
        ],
      },
      {
        id: "about",
        label: "About",
        items: [
          { path: "/about", label: "About OpenCouncils" },
          { path: "/data", label: "Open data" },
        ],
      },
    ],
  },
  // OpenCouncils serves no Welsh pages; this mirrors the English so the types and tests line up.
  cy: {
    menu: "Menu",
    close: "Close menu",
    siteMenu: "Site menu",
    search: "Search",
    darkMode: "Dark mode",
    sections: [
      {
        id: "councils",
        label: "Councils",
        items: [
          { path: "/councils", label: "All UK councils" },
          { path: "/find", label: "Find your councillors" },
          { path: "/reorganisation", label: "Councils being reorganised" },
          { path: "/compare", label: "Compare councils" },
        ],
      },
      {
        id: "decisions",
        label: "Decisions",
        items: [
          { path: "/latest", label: "Latest business" },
          { path: "/topics", label: "Topics" },
          { path: "/search", label: "Search" },
        ],
      },
      {
        id: "say",
        label: "Follow",
        items: [
          { path: "/follow", label: "Alerts and weekly email" },
          { path: "/guide", label: "How councils work" },
        ],
      },
      {
        id: "about",
        label: "About",
        items: [
          { path: "/about", label: "About OpenCouncils" },
          { path: "/data", label: "Open data" },
        ],
      },
    ],
  },
});
