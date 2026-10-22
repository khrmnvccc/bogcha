import { z } from "zod";

const req = (label: string) => `${label} kiritilishi shart`;

export const zText = (label: string, min = 1, max = 200) =>
  z.string({ error: req(label) }).trim()
    .min(min, min <= 1 ? req(label) : `${label} kamida ${min} belgidan iborat bo'lsin`)
    .max(max, `${label} ${max} belgidan oshmasin`);

export const zOptText = (max = 500) =>
  z.string().trim().max(max, `${max} belgidan oshmasin`).optional().transform((v) => (v ? v : null));

export const zPhone = z.string({ error: req("Telefon") }).trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Telefon raqami noto'g'ri. Masalan: +998 90 123 45 67");

export const zOptPhone = z.string().trim().optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\+?[0-9 ()-]{7,20}$/.test(v), "Telefon raqami noto'g'ri");

export const zDate = (label: string) =>
  z.string({ error: req(label) }).regex(/^\d{4}-\d{2}-\d{2}$/, `${label} noto'g'ri`);

export const zOptDate = z.string().optional().transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Sana noto'g'ri");

export const zTime = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Vaqt noto'g'ri");
export const zOptTime = z.string().optional().transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{2}:\d{2}(:\d{2})?$/.test(v), "Vaqt noto'g'ri");

export const zUuid = (label = "Tanlov") => z.string({ error: req(label) }).uuid(`${label} tanlanmagan`);
export const zOptUuid = z.string().optional().transform((v) => (v ? v : null))
  .refine((v) => v === null || z.string().uuid().safeParse(v).success, "Noto'g'ri tanlov");

/** Money in whole so'm; accepts "1 200 000". */
export const zMoney = (label: string) =>
  z.string({ error: req(label) })
    .transform((v) => v.replace(/[\s,']/g, ""))
    .refine((v) => /^\d{1,12}$/.test(v), `${label} butun son bo'lishi kerak`)
    .transform(Number);

export const zOptMoney = z.string().optional()
  .transform((v) => (v ? v.replace(/[\s,']/g, "") : ""))
  .refine((v) => v === "" || /^\d{1,12}$/.test(v), "Summa butun son bo'lishi kerak")
  .transform((v) => (v === "" ? null : Number(v)));

export const zUsername = z.string({ error: req("Login") }).trim().toLowerCase()
  .regex(/^[a-z0-9._-]{3,40}$/, "Login 3-40 ta lotin harfi, raqam, nuqta yoki chiziqchadan iborat bo'lsin");

export const zPassword = z.string({ error: req("Parol") })
  .min(8, "Parol kamida 8 belgidan iborat bo'lsin")
  .max(72, "Parol 72 belgidan oshmasin")
  .regex(/[A-Za-z]/, "Parolda kamida bitta harf bo'lsin")
  .regex(/[0-9]/, "Parolda kamida bitta raqam bo'lsin");

export const zCheckbox = z.string().optional().transform((v) => v === "on" || v === "true");
