import { href, type Locale } from "@/i18n/config";
import { walesMessages } from "@/i18n/messages/wales";
import { councilShort, LIVE_COUNCILS } from "@/lib/councils";
import { TOPICS } from "@/lib/topics";

/**
 * Council and topic pickers as a plain GET form, so every filtered view has
 * a URL and works without JavaScript. Hidden fields carry other settings.
 */
export function FilterForm({
  locale,
  path,
  council,
  topic,
  showTopic = true,
  hidden = {},
}: {
  locale: Locale;
  path: string;
  council?: string;
  topic?: string;
  showTopic?: boolean;
  hidden?: Record<string, string | undefined>;
}) {
  const t = walesMessages[locale].filter;
  const councils = [...LIVE_COUNCILS].sort((a, b) => councilShort(locale, a).localeCompare(councilShort(locale, b), locale));
  const topics = [...TOPICS].sort((a, b) => a[locale].localeCompare(b[locale], locale));
  return (
    <form action={href(locale, path)} method="get" className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor={`${path}-council`} className="mb-1 block text-small font-semibold">
          {t.council}
        </label>
        <select id={`${path}-council`} name="council" defaultValue={council ?? ""} className="field min-w-[14rem]">
          <option value="">{t.allCouncils}</option>
          {councils.map((c) => (
            <option key={c.id} value={c.id}>
              {councilShort(locale, c)}
            </option>
          ))}
        </select>
      </div>
      {showTopic ? (
        <div>
          <label htmlFor={`${path}-topic`} className="mb-1 block text-small font-semibold">
            {t.topic}
          </label>
          <select id={`${path}-topic`} name="topic" defaultValue={topic ?? ""} className="field min-w-[14rem]">
            <option value="">{t.allTopics}</option>
            {topics.map((x) => (
              <option key={x.slug} value={x.slug}>
                {x[locale]}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <button type="submit" className="button">
        {t.show}
      </button>
    </form>
  );
}
