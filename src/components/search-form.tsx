import { href, type Locale } from "@/i18n/config";
import { walesMessages } from "@/i18n/messages/wales";

/** A plain GET form, so every search has a URL and works without JavaScript. */
export function SearchForm({
  locale,
  q = "",
  council,
  topic,
  id = "q",
  large = false,
}: {
  locale: Locale;
  q?: string;
  council?: string;
  topic?: string;
  id?: string;
  large?: boolean;
}) {
  const t = walesMessages[locale].search;
  return (
    <form action={href(locale, "/search")} method="get" role="search" className="max-w-[40rem]">
      <label htmlFor={id} className={large ? "mb-2 block font-semibold" : "visually-hidden"}>
        {t.label}
      </label>
      <div className="flex">
        <input
          id={id}
          name="q"
          type="search"
          defaultValue={q}
          className={`field rounded-r-none ${large ? "min-h-12 text-read" : ""}`}
          placeholder={t.placeholder}
          autoComplete="off"
          enterKeyHint="search"
        />
        {council ? <input type="hidden" name="council" value={council} /> : null}
        {topic ? <input type="hidden" name="topic" value={topic} /> : null}
        <button type="submit" className={`button rounded-l-none px-4 ${large ? "min-h-12" : ""}`}>
          {t.submit}
        </button>
      </div>
    </form>
  );
}
