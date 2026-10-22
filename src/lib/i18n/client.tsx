"use client";
import * as React from "react";
import { makeI18n, type I18n, type Locale } from "./core";

const Ctx = React.createContext<I18n>(makeI18n("uz"));

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = React.useMemo(() => makeI18n(locale), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  return React.useContext(Ctx);
}

/** Translates its text child; usable from both server and client components. */
export function T({ children, vars }: { children: string; vars?: Record<string, string | number> }) {
  return <>{useI18n().t(children, vars)}</>;
}
