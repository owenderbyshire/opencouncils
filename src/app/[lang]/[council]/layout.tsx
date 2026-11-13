import Link from "next/link";
import { Suspense } from "react";
import { CouncilNav } from "@/components/council-nav";
import { href, type Locale } from "@/i18n/config";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { councilName } from "@/lib/councils";
import { councilFrom, councilParams } from "@/lib/route";

export async function generateStaticParams() {
  return councilParams();
}

export default async function CouncilLayout({ children, params }: LayoutProps<"/[lang]/[council]">) {
  const locale = await getLocale();
  return (
    <>
      <div className="border-b border-rule bg-accent-soft">
        <Suspense fallback={<div className="container-page h-[5.75rem]" />}>
          <CouncilBar locale={locale} params={params} />
        </Suspense>
      </div>
      {children}
    </>
  );
}

async function CouncilBar({ locale, params }: { locale: Locale; params: Promise<{ council: string }> }) {
  const c = await councilFrom(params);
  const t = common[locale].nav;
  const base = `/${c.id}`;
  return (
    <div className="container-page pt-3">
      <Link href={href(locale, base)} className="link-quiet font-serif text-h4 font-semibold">
        {councilName(locale, c)}
      </Link>
      <CouncilNav
        label={councilName(locale, c)}
        items={[
          { segment: null, href: href(locale, base), text: t.overview },
          { segment: "meetings", href: href(locale, `${base}/meetings`), text: t.meetings },
          { segment: "councillors", href: href(locale, `${base}/councillors`), text: t.councillors },
          { segment: "committees", href: href(locale, `${base}/committees`), text: t.committees },
        ]}
      />
    </div>
  );
}
