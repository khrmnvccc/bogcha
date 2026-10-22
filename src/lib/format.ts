// Uzbek (Latin) formatting helpers. All dates are shown in Asia/Tashkent.
export const TZ = "Asia/Tashkent";

export const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];
export const MONTHS_GENITIVE = MONTHS.map((m) => m.toLowerCase());
export const WEEKDAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];
export const WEEKDAYS_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

function parts(d: Date) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

function toDate(v: string | Date): Date {
  if (v instanceof Date) return v;
  // Plain dates ("2026-10-22") are calendar dates, not instants.
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T12:00:00+05:00`);
  return new Date(v);
}

/** Today's calendar date in Tashkent as YYYY-MM-DD. */
export function todayISO(now = new Date()): string {
  const { y, m, d } = parts(now);
  return `${y}-${m}-${d}`;
}

/** First day of the current Tashkent month as YYYY-MM-01. */
export function currentMonthISO(now = new Date()): string {
  return `${todayISO(now).slice(0, 7)}-01`;
}

export function addMonthsISO(monthISO: string, delta: number): string {
  const [y, m] = monthISO.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}-01`;
}

export function addDaysISO(dateISO: string, delta: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** 22.10.2026 */
export function formatDate(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const { y, m, d } = parts(toDate(v));
  return `${d}.${m}.${y}`;
}

/** 22-oktabr, 2026 */
export function formatDateLong(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const { y, m, d } = parts(toDate(v));
  return `${Number(d)}-${MONTHS_GENITIVE[Number(m) - 1]}, ${y}`;
}

/** 14:05 */
export function formatTime(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const { h, min } = parts(toDate(v));
  return `${h}:${min}`;
}

/** 22.10.2026, 14:05 */
export function formatDateTime(v: string | Date | null | undefined): string {
  if (!v) return "—";
  return `${formatDate(v)}, ${formatTime(v)}`;
}

/** Oktabr 2026 */
export function formatMonth(v: string | null | undefined): string {
  if (!v) return "—";
  const [y, m] = v.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function weekdayName(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`).getUTCDay();
  return WEEKDAYS[(d + 6) % 7];
}

/** 1 250 000 so'm */
export function formatSom(v: number | string | null | undefined, opts: { signed?: boolean } = {}): string {
  const n = Number(v ?? 0);
  const abs = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const sign = n < 0 ? "−" : opts.signed && n > 0 ? "+" : "";
  return `${sign}${abs} so'm`;
}

export function formatNumber(v: number | null | undefined): string {
  return Math.round(Number(v ?? 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** 7 soat 45 daqiqa */
export function formatMinutes(min: number | null | undefined): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} daqiqa`;
  return m ? `${h} soat ${m} daqiqa` : `${h} soat`;
}

export function formatHours(min: number | null | undefined): string {
  if (!min) return "0 s";
  return `${(min / 60).toFixed(1).replace(".", ",")} s`;
}

export function ageFromBirth(birthISO: string, now = new Date()): string {
  const today = todayISO(now);
  const [by, bm, bd] = birthISO.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let years = ty - by;
  let months = tm - bm;
  if (td < bd) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return years > 0 ? `${years} yosh${months ? ` ${months} oy` : ""}` : `${months} oy`;
}

/** Combine a Tashkent calendar date and HH:MM into an ISO instant. */
export function tashkentDateTimeToISO(dateISO: string, hhmm: string): string {
  return new Date(`${dateISO}T${hhmm}:00+05:00`).toISOString();
}
