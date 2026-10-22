"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { authorize, isUser, dbErrorMessage, fieldErrors, type ActionState } from "@/lib/actions";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/auth";
import { zDate, zUuid, zText } from "@/lib/validation";
import { tashkentDateTimeToISO } from "@/lib/format";
import { tr } from "@/lib/i18n/server";

const geo = z.object({
  lat: z.coerce.number().min(-90).max(90).optional().catch(undefined),
  lng: z.coerce.number().min(-180).max(180).optional().catch(undefined),
  acc: z.coerce.number().min(0).max(100000).optional().catch(undefined),
});

async function doCheck(kind: "in" | "out", fd: FormData): Promise<ActionState> {
  const user = await authorize(STAFF_ROLES);
  if (!isUser(user)) return user;
  if (!user.employeeId) return { ok: false, message: "Hisobingiz xodimga bog'lanmagan. Administratorga murojaat qiling." };
  const g = geo.parse({
    lat: fd.get("lat") || undefined, lng: fd.get("lng") || undefined, acc: fd.get("acc") || undefined,
  });
  const supabase = await createClient();
  // The timestamp is always taken from the database clock, never from the device.
  const { data, error } = await supabase.rpc(kind === "in" ? "employee_check_in" : "employee_check_out", {
    p_lat: g.lat ?? null, p_lng: g.lng ?? null, p_accuracy: g.acc ?? null,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/mening-kunim");
  revalidatePath("/ishga-kelish");
  const verified = (kind === "in" ? data?.check_in_source : data?.check_out_source) === "location";
  return {
    ok: true,
    message: kind === "in"
      ? await tr("Ishga kelganingiz qayd etildi{0}", [verified ? " (joylashuv tasdiqlandi)" : ""])
      : await tr("Ishdan ketganingiz qayd etildi{0}", [verified ? " (joylashuv tasdiqlandi)" : ""]),
  };
}

export async function checkIn(_p: ActionState, fd: FormData) {
  return doCheck("in", fd);
}
export async function checkOut(_p: ActionState, fd: FormData) {
  return doCheck("out", fd);
}

const correctionSchema = z.object({
  employee_id: zUuid("Xodim"),
  work_date: zDate("Sana"),
  check_in: z.string().regex(/^\d{2}:\d{2}$/, "Kelish vaqtini kiriting"),
  check_out: z.string().optional().transform((v) => v || null).refine((v) => v === null || /^\d{2}:\d{2}$/.test(v), "Vaqt noto'g'ri"),
  reason: zText("Sabab", 5, 500),
});

export async function setAttendance(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const parsed = correctionSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fieldErrors(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_employee_attendance", {
    p_employee_id: v.employee_id,
    p_work_date: v.work_date,
    p_check_in: tashkentDateTimeToISO(v.work_date, v.check_in),
    p_check_out: v.check_out ? tashkentDateTimeToISO(v.work_date, v.check_out) : null,
    p_reason: v.reason,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/ishga-kelish");
  return { ok: true, message: "Davomat saqlandi va audit jurnaliga yozildi" };
}

export async function reviewAttendance(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const id = zUuid().safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: "Yozuv topilmadi" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_employee_attendance", { p_id: id.data, p_note: String(fd.get("reason") ?? "") || null });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/ishga-kelish");
  return { ok: true, message: "Ko'rib chiqildi deb belgilandi" };
}
