import { href, type Locale } from "@/i18n/config";
import { walesMessages } from "@/i18n/messages/wales";

/** A GET form to the postcode lookup, so it works without JavaScript. */
export function PostcodeForm({ locale, label, value = "" }: { locale: Locale; label?: string; value?: string }) {
  const t = walesMessages[locale].find;
  return (
    <form action={href(locale, "/find")} method="get" className="max-w-[24rem]">
      <label htmlFor="postcode" className="mb-1.5 block text-small font-semibold">
        {label ?? t.label}
      </label>
      <div className="flex">
        <input
          id="postcode"
          name="postcode"
          defaultValue={value}
          className="field rounded-r-none uppercase placeholder:normal-case"
          placeholder={t.placeholder}
          autoComplete="postal-code"
          maxLength={10}
        />
        <button type="submit" className="button button-quiet rounded-l-none border-l-0 px-4">
          {t.submit}
        </button>
      </div>
    </form>
  );
}
