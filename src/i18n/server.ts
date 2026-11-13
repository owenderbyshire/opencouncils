/**
 * Server-side locale helpers.
 *
 * The locale is the root route parameter (`app/[lang]`), read with
 * `next/root-params` so any server component or data helper can get it
 * without prop drilling. Inside a `"use cache"` scope, reading it adds the
 * locale to that cache entry's key automatically.
 */
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { isLocale, type Locale } from "./config";

export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!isLocale(value)) notFound();
  return value;
}

/** A set of interface strings in both languages. Welsh must match the English shape. */
export interface Messages<T> {
  en: T;
  cy: T;
}

export function defineMessages<T>(m: { en: T; cy: NoInfer<T> }): Messages<T> {
  return m;
}

/** Returns the strings for the current request's locale. */
export async function getMessages<T>(m: Messages<T>): Promise<T> {
  return m[await getLocale()];
}

/** Picks the Welsh or English variant of a bilingual database field, falling back to whichever exists. */
export function pick(
  locale: Locale,
  en: string | null | undefined,
  cy: string | null | undefined,
): string {
  return (locale === "cy" ? cy || en : en || cy) ?? "";
}
