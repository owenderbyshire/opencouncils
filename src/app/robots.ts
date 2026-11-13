import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * Crawlers that copy pages to train AI models, asked to keep out. Search
 * engines are unaffected, and so are AI assistants that fetch a page to answer
 * someone's question. Google-Extended and Applebot-Extended only say whether
 * Google and Apple may train AI on the site; their search crawlers ignore them.
 * Vercel's firewall (AI Bots, with AI crawlers denied) turns the same crawlers
 * away; this file is the request it backs.
 */
const AI_TRAINING_CRAWLERS = ["GPTBot", "ClaudeBot", "CCBot", "Google-Extended", "Applebot-Extended", "Bytespider", "Meta-ExternalAgent"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/"] },
      { userAgent: AI_TRAINING_CRAWLERS, disallow: "/" },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
