"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/i18n/actions";
import { LOCALES, type Locale } from "@/lib/i18n/core";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** UZ / RU toggle; stores the choice in a cookie and re-renders the page. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const choose = (l: Locale) => {
    if (l === locale) return;
    start(async () => {
      await setLocale(l);
      router.refresh();
    });
  };
  return (
    <div role="group" aria-label={t("Til")} className={cn("inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold", pending && "opacity-60", className)}>
      {LOCALES.map((l) => (
        <button key={l} type="button" onClick={() => choose(l)} aria-pressed={l === locale} disabled={pending}
          className={cn("rounded-md px-2 py-1 uppercase transition-colors", l === locale ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>
          {l === "uz" ? "UZ" : "RU"}
        </button>
      ))}
    </div>
  );
}
