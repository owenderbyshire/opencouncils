import "@fontsource-variable/ibm-plex-sans";
import "@fontsource-variable/newsreader/opsz.css";
import "../globals.css";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SiteFrame } from "@/components/site-chrome";
import { absUrl, htmlLang, SERVED_LOCALES } from "@/i18n/config";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { BETA_BANNER_SCRIPT } from "@/lib/beta-banner";
import { THEME_SCRIPT } from "@/lib/theme";

export async function generateStaticParams() {
  return SERVED_LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = common[locale];
  return {
    metadataBase: new URL(absUrl(locale, "/")),
    title: { default: t.siteName, template: `%s | ${t.siteName}` },
    description: t.description,
    applicationName: t.siteName,
    formatDetection: { telephone: false, address: false, email: false },
    openGraph: { siteName: t.siteName, type: "website", locale: locale === "cy" ? "cy_GB" : "en_GB" },
  };
}

export const viewport: Viewport = {
  // Light by default; the theme script and switch change it for dark mode.
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  return (
    // The theme script sets data-js and data-theme on <html> before React loads, and the beta notice's script data-beta-dismissed.
    <html lang={htmlLang(locale)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: BETA_BANNER_SCRIPT }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          {common[locale].skipToContent}
        </a>
        <SiteFrame locale={locale}>
          <main id="main" className="flex-1">
            {children}
          </main>
        </SiteFrame>
        <Analytics />
      </body>
    </html>
  );
}
