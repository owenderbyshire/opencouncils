import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/page-header";
import { dataMessages } from "@/i18n/messages/data";
import { Rich } from "@/i18n/rich";
import { getLocale } from "@/i18n/server";
import { councilShort, LIVE_COUNCILS } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { SITE } from "@/lib/site";

/* Open data: downloads, the API and the terms. Static apart from the council list. */

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = dataMessages[locale];
  return pageMetadata({ locale, path: "/data", title: t.title, description: t.lede });
}

export default async function DataPage() {
  const locale = await getLocale();
  const t = dataMessages[locale];
  const ogl =
    locale === "cy"
      ? "https://www.nationalarchives.gov.uk/doc/open-government-licence-cymraeg/version/3/"
      : "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";
  const downloads = [
    ["/api/v1/councils?format=csv", t.downloads.councils],
    ["/api/v1/decisions?format=csv&size=1000", t.downloads.decisions],
    ["/api/v1/planning?format=csv&size=1000", t.downloads.planning],
    ["/api/v1/consultations?format=csv", t.downloads.consultations],
    ["/api/v1/cabinets?format=csv", t.downloads.cabinets],
    ["/api/v1/planned-decisions?format=csv&size=1000", t.downloads.planned],
  ] as const;
  const councils = [...LIVE_COUNCILS].sort((a, b) => councilShort(locale, a).localeCompare(councilShort(locale, b), locale));
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede} />
      <Section id="downloads" title={t.downloadsTitle} className="border-t border-rule">
        <p className="-mt-1 mb-4 max-w-[62ch] text-small text-ink-2">{t.downloadsLede}</p>
        <ul className="rows max-w-[48rem]">
          {downloads.map(([path, label]) => (
            <li key={path} className="py-3">
              <a href={path} download>
                {label}
              </a>
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-h4">{t.perCouncil}</h3>
        <p className="mt-1 max-w-[62ch] text-small text-ink-2">{t.perCouncilNote}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="data-table">
            <tbody>
              {councils.map((c) => (
                <tr key={c.id}>
                  <th scope="row" className="font-normal">
                    {councilShort(locale, c)}
                  </th>
                  <td>
                    <a href={`/api/v1/councils/${c.id}/meetings?format=csv&size=1000`} download>
                      {t.meetings}
                    </a>
                  </td>
                  <td>
                    <a href={`/api/v1/councils/${c.id}/councillors?format=csv`} download>
                      {t.councillors}
                    </a>
                  </td>
                  <td>
                    <a href={`/api/v1/councils/${c.id}/committees?format=csv`} download>
                      {t.committees}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section id="api" title={t.apiTitle} className="border-t border-rule">
        <p className="-mt-1 mb-4 max-w-[62ch]">{t.apiLede}</p>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{t.endpoint}</th>
                <th scope="col">{t.gives}</th>
              </tr>
            </thead>
            <tbody>
              {t.endpoints.map(([path, gives]) => (
                <tr key={path}>
                  <td>
                    <code className="text-small">{path.includes("{") ? path : <a href={path}>{path}</a>}</code>
                  </td>
                  <td>{gives}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section id="licence" title={t.licenceTitle} className="border-t border-rule">
        <p className="max-w-[62ch]">
          <Rich text={t.licence} links={{ ogl }} />
        </p>
      </Section>
      <Section id="fair-use" title={t.fairTitle} className="border-t border-rule">
        <p className="max-w-[62ch]">
          <Rich text={t.fair} links={{ mail: `mailto:${SITE.contactEmail}` }} />
        </p>
      </Section>
      <Section id="accuracy" title={t.accuracyTitle} className="border-t border-rule">
        <p className="max-w-[62ch]">{t.accuracy}</p>
      </Section>
    </div>
  );
}
