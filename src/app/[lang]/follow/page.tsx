import type { Metadata } from "next";
import { Suspense } from "react";
import { FollowArt } from "@/components/illustrations";
import { PageHeader } from "@/components/page-header";
import { BlockSkeleton } from "@/components/skeleton";
import { getSubscriber } from "@/data/subscribers";
import { type Locale } from "@/i18n/config";
import { common } from "@/i18n/messages/common";
import { followMessages } from "@/i18n/messages/follow";
import { getLocale } from "@/i18n/server";
import { LIVE_COUNCILS, councilShort } from "@/lib/councils";
import { checkEmailToken, emailToken } from "@/lib/email/token";
import { pageMetadata } from "@/lib/metadata";
import { param, type SearchParams } from "@/lib/params";
import { TOPICS, topicName } from "@/lib/topics";
import { saveChoicesAction, subscribeAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = followMessages[locale];
  return pageMetadata({ locale, path: "/follow", title: t.title, description: t.lede });
}

export default async function FollowPage({ searchParams }: PageProps<"/[lang]/follow">) {
  const locale = await getLocale();
  const t = followMessages[locale];
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede} kicker={<FollowArt size={48} className="text-ink" />} />
      <Suspense fallback={<BlockSkeleton lines={8} label={common[locale].words.loading} />}>
        <Body locale={locale} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </div>
  );
}

async function Body({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const t = followMessages[locale];
  const sp = await searchParams;
  const u = param(sp, "u") ?? "";
  const tok = param(sp, "t") ?? "";
  const status = (["sent", "confirmed", "saved", "stopped"] as const).find((k) => param(sp, k));
  const error = param(sp, "error");
  const errorText =
    error === "email" ? t.errorEmail : error === "postcode" ? t.errorPostcode : error === "keywords" ? t.errorKeywords : error === "choose" ? t.errorChoose : error === "link" ? t.errorLink : error === "send" ? t.errorSend : error === "busy" ? t.errorBusy : null;

  // Managing an existing subscription from the link in an email.
  const manage = u && u.length <= 100 && checkEmailToken("manage", u, tok);
  const current = manage ? ((await getSubscriber(u)) ?? undefined) : undefined;
  const preCouncil = param(sp, "council");
  const chosenCouncils = new Set(current?.councils ?? (preCouncil ? [preCouncil] : []));
  const chosenTopics = new Set(current?.topics ?? []);
  const stop = current ? `/api/email/stop?u=${encodeURIComponent(u)}&t=${emailToken("digest", u)}&lang=${locale}` : null;

  return (
    <div className="border-t border-rule pt-6">
      {status ? (
        <p role="status" className="mb-6 max-w-[62ch] rounded border border-rule bg-surface p-4 font-semibold">
          {t[status]}
        </p>
      ) : null}
      {errorText ? (
        <p role="alert" className="mb-6 max-w-[62ch] rounded border border-rule bg-surface p-4">
          {errorText}
        </p>
      ) : null}
      {status === "sent" || status === "confirmed" || status === "stopped" ? null : (
        <form action={current ? saveChoicesAction : subscribeAction} className="max-w-[48rem] space-y-8">
          <input type="hidden" name="lang" value={locale} />
          {current ? (
            <>
              <input type="hidden" name="u" value={u} />
              <input type="hidden" name="t" value={tok} />
              <div>
                <h2 className="text-h3">{t.manageTitle}</h2>
                <p className="mt-1 text-ink-2">{t.manageLede}</p>
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="email" className="block font-semibold">
                {t.email}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-2 w-full max-w-[28rem] rounded border border-rule-strong bg-bg px-3 py-2"
              />
              {/* Hidden from people; bots fill it in. */}
              <div aria-hidden="true" className="absolute -left-[9999px]">
                <label>
                  Website <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
            </div>
          )}
          <fieldset>
            <legend className="font-semibold">{t.councils}</legend>
            <p className="text-small text-ink-2">{t.councilsHint}</p>
            <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {[...LIVE_COUNCILS]
                .sort((a, b) => councilShort(locale, a).localeCompare(councilShort(locale, b), locale))
                .map((c) => (
                  <label key={c.id} className="flex items-center gap-2">
                    <input type="checkbox" name="council" value={c.id} defaultChecked={chosenCouncils.has(c.id)} />
                    {councilShort(locale, c)}
                  </label>
                ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="font-semibold">{t.topics}</legend>
            <p className="text-small text-ink-2">{t.topicsHint}</p>
            <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {TOPICS.map((tp) => (
                <label key={tp.slug} className="flex items-center gap-2">
                  <input type="checkbox" name="topic" value={tp.slug} defaultChecked={chosenTopics.has(tp.slug)} />
                  {topicName(locale, tp.slug)}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="postcode" className="block font-semibold">
              {t.postcode}
            </label>
            <p className="text-small text-ink-2">{t.postcodeHint}</p>
            <input
              id="postcode"
              name="postcode"
              defaultValue={current?.postcode ?? ""}
              autoComplete="postal-code"
              className="mt-2 w-44 rounded border border-rule-strong bg-bg px-3 py-2 uppercase"
            />
          </div>
          <div>
            <label htmlFor="keywords" className="block font-semibold">
              {t.keywords}
            </label>
            <p className="max-w-[62ch] text-small text-ink-2">{t.keywordsHint}</p>
            <textarea
              id="keywords"
              name="keywords"
              rows={4}
              defaultValue={(current?.keywords ?? []).join("\n")}
              className="mt-2 w-full max-w-[28rem] rounded border border-rule-strong bg-bg px-3 py-2"
            />
          </div>
          <div>
            <label className="flex items-start gap-2 font-semibold">
              <input type="checkbox" name="instant" defaultChecked={current?.instant ?? false} className="mt-1.5" />
              {t.instant}
            </label>
            <p className="ml-6 max-w-[62ch] text-small text-ink-2">{t.instantHint}</p>
          </div>
          <div>
            <button type="submit" className="button">
              {current ? t.save : t.submit}
            </button>
            <p className="mt-4 max-w-[62ch] text-small text-ink-2">{t.privacy}</p>
            {stop ? (
              <p className="mt-2 text-small">
                <a href={stop}>{t.stopLink}</a>
              </p>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}
