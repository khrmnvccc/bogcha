"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize, isUser, dbErrorMessage, type ActionState } from "@/lib/actions";
import { STAFF_ROLES } from "@/lib/auth";
import { tr } from "@/lib/i18n/server";

const UUID = /^[0-9a-f-]{36}$/i;

/** Marks today's arrival or departure. The camera image never reaches the server; only the decision does. */
export async function childCheck(childId: string, action: "in" | "out", method: "face" | "manual"): Promise<ActionState> {
  const user = await authorize(STAFF_ROLES);
  if (!isUser(user)) return { ...user, message: await tr(user.message ?? "") };
  if (!UUID.test(childId) || !["in", "out"].includes(action) || !["face", "manual"].includes(method)) return { ok: false, message: await tr("Noto'g'ri ma'lumot") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("child_check", { p_child: childId, p_action: action, p_method: method });
  if (error) return { ok: false, message: await tr(dbErrorMessage(error)) };
  revalidatePath("/davomat");
  return { ok: true, message: await tr(action === "in" ? "Keldi deb belgilandi" : "Ketdi deb belgilandi"), data: { at: data as string } };
}

export async function setFaceConsent(childId: string, value: boolean): Promise<ActionState> {
  const user = await authorize(null);
  if (!isUser(user)) return { ...user, message: await tr(user.message ?? "") };
  if (!UUID.test(childId)) return { ok: false, message: await tr("Noto'g'ri ma'lumot") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_face_consent", { p_child: childId, p_value: value });
  if (error) return { ok: false, message: await tr(dbErrorMessage(error)) };
  revalidatePath("/", "layout");
  return { ok: true, message: await tr(value ? "Rozilik berildi" : "Rozilik bekor qilindi") };
}
