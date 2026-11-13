import Link from "next/link";
import { href } from "@/i18n/config";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";

export default async function NotFound() {
  const locale = await getLocale();
  const t = common[locale].notFound;
  return (
    <div className="container-page py-16">
      <h1 className="text-h1">{t.title}</h1>
      <p className="mt-4 max-w-[52ch] text-ink-2">{t.body}</p>
      <p className="mt-8 flex flex-wrap gap-3">
        <Link className="button" href={href(locale, "/")}>
          {t.home}
        </Link>
        <Link className="button button-quiet" href={href(locale, "/search")}>
          {t.search}
        </Link>
      </p>
    </div>
  );
}
