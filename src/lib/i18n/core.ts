import * as base from "@/lib/format";
import ru from "./ru.json";

export type Locale = "uz" | "ru";
export const LOCALES: Locale[] = ["uz", "ru"];
export const LOCALE_COOKIE = "lang";
export const LOCALE_NAMES: Record<Locale, string> = { uz: "O'zbekcha", ru: "Русский" };

export function isLocale(v: unknown): v is Locale {
  return v === "uz" || v === "ru";
}

type Vars = Record<string, string | number> | (string | number)[];

/** Uzbek text is the key; other locales look it up and fall back to Uzbek. */
export type TFn = (key: string, vars?: Vars) => string;

const DICTS: Record<Locale, Record<string, string> | null> = { uz: null, ru: ru as Record<string, string> };

export function makeT(locale: Locale): TFn {
  const dict = DICTS[locale];
  return (key, vars) => {
    const text = (dict && dict[key]) || key;
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (m, k) => {
      const v = (vars as Record<string, string | number>)[k];
      return v === undefined || v === null ? m : String(v);
    });
  };
}

const RU_MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const RU_MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const RU_WEEKDAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const RU_WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Russian plural form: 1 год, 2 года, 5 лет. */
export function ruPlural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/** Locale-bound versions of the text-producing helpers in lib/format. */
export function makeFormat(locale: Locale) {
  return withUnbreakableMoney(makeFormatRaw(locale));
}

/** Keeps "1 250 000 so'm" on one line in the UI. */
function withUnbreakableMoney<F extends { formatSom: (v: number | string | null | undefined, opts?: { signed?: boolean }) => string }>(f: F): F {
  return { ...f, formatSom: (v: number | string | null | undefined, opts?: { signed?: boolean }) => f.formatSom(v, opts).replace(/ /g, "\u00a0") };
}

function makeFormatRaw(locale: Locale) {
  if (locale === "uz") {
    return {
      MONTHS: base.MONTHS, WEEKDAYS: base.WEEKDAYS, WEEKDAYS_SHORT: base.WEEKDAYS_SHORT,
      formatDateLong: base.formatDateLong, formatMonth: base.formatMonth, formatSom: base.formatSom,
      formatMinutes: base.formatMinutes, formatHours: base.formatHours, ageFromBirth: base.ageFromBirth,
      weekdayName: base.weekdayName,
    };
  }
  const somSuffix = (s: string) => s.replace(/ so'm$/, " сум");
  return {
    MONTHS: RU_MONTHS,
    WEEKDAYS: RU_WEEKDAYS,
    WEEKDAYS_SHORT: RU_WEEKDAYS_SHORT,
    formatDateLong(v: string | Date | null | undefined) {
      if (!v) return "—";
      const [d, m, y] = base.formatDate(v).split(".");
      return `${Number(d)} ${RU_MONTHS_GEN[Number(m) - 1]} ${y}`;
    },
    formatMonth(v: string | null | undefined) {
      if (!v) return "—";
      const [y, m] = v.split("-").map(Number);
      return `${RU_MONTHS[m - 1]} ${y}`;
    },
    formatSom: (v: number | string | null | undefined, opts: { signed?: boolean } = {}) => somSuffix(base.formatSom(v, opts)),
    formatMinutes(min: number | null | undefined) {
      if (min == null) return "—";
      const h = Math.floor(min / 60);
      const m = min % 60;
      if (h === 0) return `${m} мин`;
      return m ? `${h} ч ${m} мин` : `${h} ч`;
    },
    formatHours(min: number | null | undefined) {
      if (!min) return "0 ч";
      return `${(min / 60).toFixed(1).replace(".", ",")} ч`;
    },
    ageFromBirth(birthISO: string, now = new Date()) {
      const uz = base.ageFromBirth(birthISO, now);
      const y = /^(\d+) yosh/.exec(uz);
      const mo = /(\d+) oy/.exec(uz);
      const years = y ? Number(y[1]) : 0;
      const months = mo ? Number(mo[1]) : 0;
      const ys = `${years} ${ruPlural(years, "год", "года", "лет")}`;
      const ms = `${months} мес.`;
      return years > 0 ? (months ? `${ys} ${ms}` : ys) : ms;
    },
    weekdayName(dateISO: string) {
      const d = new Date(`${dateISO}T00:00:00Z`).getUTCDay();
      return RU_WEEKDAYS[(d + 6) % 7];
    },
  };
}

export type Formatters = ReturnType<typeof makeFormatRaw>;

export type I18n = { locale: Locale; t: TFn; f: Formatters };

export function makeI18n(locale: Locale): I18n {
  return { locale, t: makeT(locale), f: makeFormat(locale) };
}
