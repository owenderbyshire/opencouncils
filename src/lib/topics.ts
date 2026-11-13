import { TOPIC_BY_SLUG, TOPICS, type TopicDef } from "@data/curated/topics";
import type { Locale } from "@/i18n/config";

export { TOPICS, TOPIC_BY_SLUG, type TopicDef };

export function topicName(locale: Locale, slug: string): string {
  const t = TOPIC_BY_SLUG.get(slug);
  return t ? t[locale] : slug;
}

export function topicNote(locale: Locale, t: TopicDef): string {
  return locale === "cy" ? t.noteCy : t.noteEn;
}
