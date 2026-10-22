import type { I18n } from "@/lib/i18n/core";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  ADJUSTMENT_KIND, ATTENDANCE_SOURCE, ATTENDANCE_STATUS, AUDIENCE_LABELS, CHILD_STATUS, EMPLOYMENT_STATUS,
  INVOICE_STATUS, NOTE_CATEGORY, PAYMENT_METHOD, PERMISSION_LABELS, ROLE_LABELS,
} from "@/lib/labels";

/** Human names for audited columns. Columns not listed here are technical and hidden. */
export const FIELD_LABELS: Record<string, string> = {
  full_name: "F.I.Sh.", name: "Nomi", title: "Sarlavha", body: "Matn", username: "Login", role: "Rol",
  phone: "Telefon", phone2: "Qo'shimcha telefon", address: "Manzil", workplace: "Ish joyi", email: "Email",
  telegram: "Telegram", permissions: "Qo'shimcha ruxsatlar", is_active: "Faol", must_change_password: "Parolni almashtirishi kerak",
  position: "Lavozim", start_date: "Ishga kirgan sana", end_date: "Tugash", status: "Holat", schedule_start: "Ish boshlanishi",
  schedule_end: "Ish tugashi", work_days: "Ish kunlari", notes: "Izoh", note: "Izoh",
  birth_date: "Tug'ilgan sana", gender: "Jinsi", enrollment_date: "Qabul qilingan sana", leave_date: "Ketgan sana",
  monthly_fee: "Oylik to'lov", age_range: "Yosh oralig'i", room: "Xona (sinf)", capacity: "Sig'imi (bolalar soni)",
  relationship: "Qarindoshligi", is_primary: "Asosiy", can_pickup: "Olib keta oladi", is_lead: "Asosiy tarbiyachi",
  category: "Turi", date: "Sana", work_date: "Sana", check_in_at: "Kelish vaqti", check_out_at: "Ketish vaqti",
  check_in_source: "Kim belgiladi", late_minutes: "Kechikish (daq)", early_leave_minutes: "Erta ketish (daq)",
  worked_minutes: "Ishlangan vaqt", review_status: "Tekshiruv", is_corrected: "Tuzatilgan",
  period: "Oy", base_amount: "Asosiy summa", adjustments_total: "Chegirma/tuzatish", paid_total: "To'langan",
  amount_due: "To'lanishi kerak", balance: "Qoldiq", due_date: "Muddat", kind: "Turi", amount: "Summa", reason: "Sabab",
  method: "To'lov usuli", paid_on: "To'lov sanasi", receipt_number: "Kvitansiya raqami", is_void: "Bekor qilingan",
  void_reason: "Bekor qilish sababi", audience: "Kimga", is_pinned: "Yuqoriga mahkamlangan",
  kindergarten_name: "Bog'cha nomi", working_hours_text: "Ish vaqti (matn)", default_monthly_fee: "Standart oylik to'lov (so'm)",
  billing_due_day: "To'lov muddati (oyning kuni)", work_start: "Ish boshlanishi", work_end: "Ish tugashi",
  late_grace_minutes: "Kechikish chegarasi (daqiqa)", early_leave_grace_minutes: "Erta ketish chegarasi (daqiqa)",
  min_shift_minutes: "Minimal ish vaqti (daqiqa)", max_shift_minutes: "Maksimal ish vaqti (daqiqa)",
  location_radius_m: "Radius (metr)", photo_updated_at: "Rasm", is_current: "Joriy",
  arrived_at: "Kelgan vaqti", left_at: "Ketgan vaqti", check_method: "Qanday belgilandi", face_consent: "Yuz orqali tekshirishga rozilik",
};

const MONEY = new Set(["monthly_fee", "base_amount", "adjustments_total", "paid_total", "amount_due", "balance", "amount", "default_monthly_fee"]);
const ENUMS: Record<string, Record<string, string | { label: string }>> = {
  role: ROLE_LABELS, method: PAYMENT_METHOD, kind: ADJUSTMENT_KIND, audience: AUDIENCE_LABELS, category: NOTE_CATEGORY,
  check_in_source: ATTENDANCE_SOURCE, check_method: { face: "Yuz orqali", manual: "Qo'lda" },
};
const STATUS_BY_ENTITY: Record<string, Record<string, { label: string }>> = {
  children: CHILD_STATUS, employees: EMPLOYMENT_STATUS, invoices: INVOICE_STATUS, child_attendance: ATTENDANCE_STATUS,
};
const GENDER: Record<string, string> = { male: "O'g'il bola", female: "Qiz bola" };
const REVIEW: Record<string, string> = { ok: "Ko'rib chiqilgan", needs_review: "Tekshirish kerak", reviewed: "Ko'rib chiqildi" };

export function fieldLabel(k: string) {
  return FIELD_LABELS[k];
}

/** Formats one audited value for people: labels for enums, so'm for money, readable dates. */
export function formatAuditValue(entity: string, key: string, v: unknown, { t, f }: Pick<I18n, "t" | "f">): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? t("Ha") : t("Yo'q");
  if (MONEY.has(key)) return f.formatSom(Number(v));
  if (key === "status" && STATUS_BY_ENTITY[entity]?.[String(v)]) return t(STATUS_BY_ENTITY[entity][String(v)].label);
  if (ENUMS[key]) {
    const e = ENUMS[key][String(v)];
    if (e) return t(typeof e === "string" ? e : e.label);
  }
  if (key === "gender") return t(GENDER[String(v)] ?? String(v));
  if (key === "review_status") return t(REVIEW[String(v)] ?? String(v));
  if (key === "permissions" && Array.isArray(v)) return v.length ? v.map((p) => t(PERMISSION_LABELS[p]?.label ?? p)).join(", ") : "—";
  if (key === "work_days" && Array.isArray(v)) return v.map((d) => f.WEEKDAYS_SHORT[(Number(d) + 6) % 7] ?? d).join(", ");
  if (key === "period" && typeof v === "string") return f.formatMonth(v);
  if (key === "worked_minutes") return f.formatMinutes(Number(v));
  if (key === "photo_updated_at") return t("yangilandi");
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return formatDateTime(v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDate(v);
  if (typeof v === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(v)) return v.slice(0, 5);
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** The person or thing a log entry is about, e.g. the child's name for a payment. */
export function subjectIds(entity: string, data: Record<string, unknown>) {
  const s = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : undefined);
  return {
    child: s("child_id") ?? (entity === "children" ? s("id") : undefined),
    employee: s("employee_id") ?? (entity === "employees" ? s("id") : undefined),
    guardian: s("guardian_id") ?? (entity === "guardians" ? s("id") : undefined),
    group: s("group_id") ?? (entity === "kg_groups" ? s("id") : undefined),
    profile: entity === "profiles" ? s("id") : undefined,
  };
}
