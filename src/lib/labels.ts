export type Role = "director" | "admin" | "teacher" | "accountant" | "parent";

export const ROLE_LABELS: Record<Role, string> = {
  director: "Direktor",
  admin: "Administrator",
  teacher: "Tarbiyachi / xodim",
  accountant: "Hisobchi / kassir",
  parent: "Ota-ona",
};

export const PERMISSION_LABELS: Record<string, { label: string; hint: string }> = {
  "attendance.correct": { label: "O'tgan kunlar davomatini tuzatish", hint: "O'z guruhidagi bolalar uchun, sabab bilan" },
  "children.view_notes": { label: "Bolalar haqidagi maxfiy izohlarni ko'rish", hint: "Oilaviy va xulq-atvor izohlari" },
  "announcements.publish": { label: "E'lon e'lon qilish", hint: "Tarbiyachi faqat o'z guruhiga" },
  "finance.adjust": { label: "Chegirma va tuzatish kiritish", hint: "Hisoblarga chegirma yoki qo'shimcha summa" },
  "finance.view": { label: "Moliyaviy hisobotlarni ko'rish", hint: "Faqat ko'rish, to'lov kiritmaydi" },
};

export const EMPLOYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Faol", tone: "green" },
  on_leave: { label: "Ta'tilda", tone: "amber" },
  terminated: { label: "Ishdan bo'shagan", tone: "gray" },
};

export const CHILD_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Faol", tone: "green" },
  paused: { label: "To'xtatilgan", tone: "amber" },
  left: { label: "Ketgan", tone: "gray" },
  graduated: { label: "Bitirgan", tone: "blue" },
};

export const ATTENDANCE_STATUS: Record<string, { label: string; tone: Tone; short: string }> = {
  present: { label: "Keldi", tone: "green", short: "K" },
  absent: { label: "Kelmagan", tone: "red", short: "Y" },
  late: { label: "Kechikdi", tone: "amber", short: "Ke" },
  excused: { label: "Sababli kelmadi", tone: "blue", short: "S" },
};

export const INVOICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  paid: { label: "To'langan", tone: "green" },
  partial: { label: "Qisman to'langan", tone: "amber" },
  unpaid: { label: "To'lanmagan", tone: "red" },
};

export const PAYMENT_METHOD: Record<string, string> = {
  cash: "Naqd pul",
  bank_transfer: "Bank o'tkazmasi",
  card: "Karta (terminal)",
  other: "Boshqa",
};

export const ADJUSTMENT_KIND: Record<string, string> = {
  discount: "Chegirma",
  surcharge: "Qo'shimcha to'lov",
  correction: "Tuzatish",
};

export const ATTENDANCE_SOURCE: Record<string, { label: string; tone: Tone; hint: string }> = {
  self: { label: "O'zi belgiladi", tone: "gray", hint: "Xodimning o'zi tugmani bosgan, joylashuv tasdiqlanmagan" },
  location: { label: "Joylashuv tasdiqlangan", tone: "green", hint: "Qurilma joylashuvi bog'cha hududida edi (GPS, qurilma ma'lumoti)" },
  biometric: { label: "Biometrik", tone: "blue", hint: "Biometrik qurilma orqali" },
  admin: { label: "Administrator kiritgan", tone: "violet", hint: "Qo'lda kiritilgan yoki tuzatilgan" },
};

export const AUDIENCE_LABELS: Record<string, string> = {
  everyone: "Hamma",
  all_parents: "Barcha ota-onalar",
  all_staff: "Barcha xodimlar",
  group: "Guruh",
  guardian: "Alohida ota-ona",
};

export const NOTE_CATEGORY: Record<string, string> = {
  general: "Umumiy",
  medical: "Sog'liq",
  allergy: "Allergiya",
  behavior: "Xulq-atvor",
  family: "Oilaviy",
};

export const AUDIT_ENTITY: Record<string, string> = {
  profiles: "Foydalanuvchi",
  employees: "Xodim",
  kg_groups: "Guruh",
  group_teachers: "Guruh tarbiyachisi",
  children: "Bola",
  guardians: "Ota-ona",
  child_guardians: "Bola-ota-ona bog'lanishi",
  child_notes: "Bola izohi",
  employee_attendance: "Xodim davomati",
  child_attendance: "Bola davomati",
  invoices: "Oylik hisob",
  invoice_adjustments: "Chegirma/tuzatish",
  payments: "To'lov",
  announcements: "E'lon",
  settings: "Sozlamalar",
};

export const AUDIT_ACTION: Record<string, string> = {
  insert: "Qo'shildi",
  update: "O'zgartirildi",
  delete: "O'chirildi",
};

export type Tone = "green" | "red" | "amber" | "blue" | "gray" | "violet";
