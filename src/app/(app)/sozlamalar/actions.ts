"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { authorize, isUser, dbErrorMessage, fieldErrors, type ActionState } from "@/lib/actions";
import { ADMIN_ROLES } from "@/lib/auth";
import { env } from "@/lib/env";
import { registerTelegramWebhook, telegramBotUsername, telegramConfigured } from "@/lib/integrations/telegram";
import { zText, zOptText, zOptPhone, zMoney, zTime, zDate, zUuid } from "@/lib/validation";

const int = (label: string, min: number, max: number) =>
  z.coerce.number({ error: `${label} son bo'lsin` }).int(`${label} butun son bo'lsin`).min(min, `${label} kamida ${min}`).max(max, `${label} ko'pi bilan ${max}`);
const optCoord = (min: number, max: number) => z.string().optional().transform((v) => (v ? Number(v.replace(",", ".")) : null))
  .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), "Koordinata noto'g'ri");

const schema = z.object({
  kindergarten_name: zText("Bog'cha nomi", 2, 150),
  address: zOptText(300),
  phone: zOptPhone,
  phone2: zOptPhone,
  email: z.string().trim().optional().transform((v) => v || null).refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Email noto'g'ri"),
  telegram: zOptText(100),
  working_hours_text: zOptText(150),
  default_monthly_fee: zMoney("Oylik to'lov"),
  billing_due_day: int("To'lov kuni", 1, 28),
  work_start: zTime,
  work_end: zTime,
  late_grace_minutes: int("Kechikish chegarasi", 0, 240),
  early_leave_grace_minutes: int("Erta ketish chegarasi", 0, 240),
  min_shift_minutes: int("Minimal ish vaqti", 0, 720),
  max_shift_minutes: int("Maksimal ish vaqti", 60, 1440),
  location_lat: optCoord(-90, 90),
  location_lng: optCoord(-180, 180),
  location_radius_m: int("Radius", 10, 5000),
}).refine((v) => v.work_end > v.work_start, { path: ["work_end"], message: "Ish tugashi boshlanishidan keyin bo'lsin" });

export async function saveSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fieldErrors(p.error);
  const days = fd.getAll("work_days").map(Number).filter((d) => d >= 1 && d <= 7);
  if (!days.length) return { ok: false, message: "Kamida bitta ish kunini tanlang" };
  const supabase = await createClient();
  const { error } = await supabase.from("settings").update({ ...p.data, work_days: days }).eq("id", 1);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Sozlamalar saqlandi" };
}

export async function savePeriod(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const p = z.object({ name: zText("Nomi", 2, 100), start_date: zDate("Boshlanish"), end_date: zDate("Tugash"), is_current: z.string().optional().transform((v) => v === "on") })
    .refine((v) => v.end_date > v.start_date, { path: ["end_date"], message: "Tugash sanasi boshlanishdan keyin bo'lsin" })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return fieldErrors(p.error);
  const supabase = await createClient();
  if (p.data.is_current) await supabase.from("academic_periods").update({ is_current: false }).eq("is_current", true);
  const { error } = await supabase.from("academic_periods").insert(p.data);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/sozlamalar");
  return { ok: true, message: "O'quv davri qo'shildi" };
}

export async function setCurrentPeriod(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const id = zUuid().safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: "Topilmadi" };
  const supabase = await createClient();
  await supabase.from("academic_periods").update({ is_current: false }).eq("is_current", true);
  const { error } = await supabase.from("academic_periods").update({ is_current: true }).eq("id", id.data);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/sozlamalar");
  return { ok: true, message: "Joriy o'quv davri o'zgartirildi" };
}

export async function connectTelegramBot(): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  if (!telegramConfigured()) return { ok: false, message: "TELEGRAM_BOT_TOKEN sozlanmagan" };
  try {
    await registerTelegramWebhook(env.appUrl());
  } catch (e) {
    return { ok: false, message: `Botni ulab bo'lmadi: ${(e as Error).message}` };
  }
  const username = await telegramBotUsername();
  return { ok: true, message: `Bot ulandi${username ? ` (@${username})` : ""}. Foydalanuvchilar endi Profil sahifasidan Telegram'ni ulay oladi.` };
}
