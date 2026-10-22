"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize, isUser, dbErrorMessage, type ActionState } from "@/lib/actions";
import { tr } from "@/lib/i18n/server";

const UUID = /^[0-9a-f-]{36}$/i;

export async function reportAbsence(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(["parent"]);
  if (!isUser(user)) return { ...user, message: await tr(user.message ?? "") };
  const child = String(fd.get("child_id") ?? "");
  const date = String(fd.get("date") ?? "");
  const note = String(fd.get("note") ?? "").trim();
  if (!UUID.test(child)) return { ok: false, message: await tr("Noto'g'ri ma'lumot") };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, errors: { date: [await tr("Sanani tanlang")] } };
  if (note.length > 300) return { ok: false, errors: { note: [await tr("Izoh 300 belgidan oshmasin")] } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_child_absence", { p_child: child, p_date: date, p_note: note || null });
  if (error) return { ok: false, message: await tr(dbErrorMessage(error)) };
  revalidatePath("/ota-ona");
  return { ok: true, message: await tr("Tarbiyachiga xabar yuborildi") };
}

export async function cancelAbsence(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(["parent"]);
  if (!isUser(user)) return { ...user, message: await tr(user.message ?? "") };
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) return { ok: false, message: await tr("Noto'g'ri ma'lumot") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_child_absence", { p_id: id });
  if (error) return { ok: false, message: await tr(dbErrorMessage(error)) };
  revalidatePath("/ota-ona");
  return { ok: true, message: await tr("Xabar bekor qilindi") };
}
