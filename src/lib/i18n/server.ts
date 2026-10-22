import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, makeI18n, type Locale } from "./core";

export const getLocale = cache(async (): Promise<Locale> => {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : "uz";
});

/** Translator and locale-bound formatters for server components and actions. */
export const getI18n = cache(async () => makeI18n(await getLocale()));

/** Translates a message with placeholders inside server actions. */
export async function tr(key: string, vars?: (string | number | null | undefined)[]): Promise<string> {
  return (await getI18n()).t(key, vars?.map((v) => v ?? ""));
}
