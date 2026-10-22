"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { authorize, isUser, dbErrorMessage, fieldErrors, type ActionState } from "@/lib/actions";
import { zPhone, zOptPhone, zOptText } from "@/lib/validation";

export async function updateMyContact(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(null);
  if (!isUser(user)) return user;
  const p = z.object({ phone: zPhone, phone2: zOptPhone, address: zOptText(300), workplace: zOptText(200) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return fieldErrors(p.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_contact", { p_phone: p.data.phone, p_phone2: p.data.phone2, p_address: p.data.address, p_workplace: p.data.workplace });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/profil");
  return { ok: true, message: "Aloqa ma'lumotlari yangilandi" };
}

export async function markAllRead(): Promise<ActionState> {
  const user = await authorize(null);
  if (!isUser(user)) return user;
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notifications_read", { p_ids: null });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Barchasi o'qilgan deb belgilandi" };
}
