"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorize, isUser, dbErrorMessage, type ActionState } from "@/lib/actions";
import { ADMIN_ROLES } from "@/lib/auth";
import { zUuid } from "@/lib/validation";
import { PERMISSION_LABELS } from "@/lib/labels";

export async function updateUserAccess(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const p = z.object({
    profile_id: zUuid(),
    role: z.enum(["director", "admin", "teacher", "accountant", "parent"]),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: "Noto'g'ri so'rov" };
  const perms = fd.getAll("permissions").map(String).filter((x) => x in PERMISSION_LABELS);
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("id, role").eq("id", p.data.profile_id).single();
  if (!target) return { ok: false, message: "Foydalanuvchi topilmadi" };
  if (target.id === user.id) return { ok: false, message: "O'z rolingizni o'zgartira olmaysiz" };
  if ((target.role === "parent") !== (p.data.role === "parent")) {
    return { ok: false, message: "Ota-ona hisobini xodim hisobiga (yoki aksincha) aylantirib bo'lmaydi. Alohida hisob yarating." };
  }
  if ((["director", "admin"].includes(p.data.role) || ["director", "admin"].includes(target.role)) && user.profile.role !== "director") {
    return { ok: false, message: "Rahbar rollarini faqat direktor boshqaradi" };
  }
  // Role/permission changes are also guarded by a database trigger.
  const { error } = await supabase.from("profiles").update({ role: p.data.role, permissions: p.data.role === "parent" ? [] : perms }).eq("id", target.id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  await createAdminClient().auth.admin.updateUserById(target.id, { app_metadata: { role: p.data.role } });
  revalidatePath("/foydalanuvchilar");
  return { ok: true, message: "Kirish huquqlari yangilandi" };
}
