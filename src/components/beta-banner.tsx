import type { Locale } from "@/i18n/config";
import { common } from "@/i18n/messages/common";
import { Rich } from "@/i18n/rich";
import { SITE } from "@/lib/site";
import { BetaBannerDismiss } from "./beta-banner-dismiss";

/**
 * The beta notice: a thin bar above the top bar on every page, beside the
 * sidebar on wide screens and one short line on a phone. It sits outside
 * <main> and carries data-nosnippet, so search results leave it out, and
 * printouts leave it out too. Once a reader closes it, the script in <head>
 * (src/lib/beta-banner.ts) marks <html> before the first paint and the
 * `[[data-beta-dismissed]_&]:hidden` class hides it.
 */
export function BetaBanner({ locale }: { locale: Locale }) {
  const t = common[locale].beta;
  const values = { email: SITE.contactEmail };
  const links = { email: `mailto:${SITE.contactEmail}` };
  const strong = "font-semibold text-ink";
  return (
    <div
      role="region"
      aria-label={t.label}
      data-beta-banner=""
      data-nosnippet=""
      className="shrink-0 border-b border-rule bg-surface print:hidden [[data-beta-dismissed]_&]:hidden"
    >
      <div className="flex min-h-9 items-center gap-2 px-4 py-1 lg:px-8">
        <p className="min-w-0 flex-1 text-meta text-ink-2">
          <span className="sm:hidden">
            <Rich text={t.short} values={values} links={links} strongClassName={strong} />
          </span>
          <span className="hidden sm:inline">
            <Rich text={t.long} values={values} links={links} strongClassName={strong} />
          </span>
        </p>
        <BetaBannerDismiss label={t.dismiss} />
      </div>
    </div>
  );
}
