import type { Locale } from "@/i18n/config";
import { walesMessages } from "@/i18n/messages/wales";
import { SITE } from "@/lib/site";

/** Feed and calendar links for a page. Both are plain public URLs: nothing to sign up for. */
export function FollowLinks({ locale, rss, ics }: { locale: Locale; rss?: string; ics?: string }) {
  const t = walesMessages[locale].feeds;
  const lang = locale === "cy" ? `${rss?.includes("?") ? "&" : "?"}lang=cy` : "";
  return (
    <div className="space-y-3 text-small">
      {rss ? (
        <div>
          <a href={`${rss}${lang}`} type="application/rss+xml">
            {t.rss}
          </a>
          <p className="text-meta text-ink-2">{t.rssNote}</p>
        </div>
      ) : null}
      {ics ? (
        <div>
          <a href={`${SITE.url.replace(/^https?:/, "webcal:")}${ics}`}>{t.ics}</a>
          <p className="text-meta text-ink-2">{t.icsNote}</p>
        </div>
      ) : null}
    </div>
  );
}
