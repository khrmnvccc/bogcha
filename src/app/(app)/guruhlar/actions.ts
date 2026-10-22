"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { authorize, isUser, dbErrorMessage, fieldErrors, type ActionState } from "@/lib/actions";
import { ADMIN_ROLES } from "@/lib/auth";
import { zText, zOptText, zOptMoney, zOptUuid, zUuid } from "@/lib/validation";

const groupSchema = z.object({
  name: zText("Guruh nomi", 1, 80),
  age_range: zOptText(40),
  room: zOptText(80),
  capacity: z.string().optional().transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 200), "Sig'im 1-200 oralig'ida bo'lsin"),
  monthly_fee: zOptMoney,
  academic_period_id: zOptUuid,
});

export async function saveGroup(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const parsed = groupSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fieldErrors(parsed.error);
  const id = fd.get("id") ? String(fd.get("id")) : null;
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("kg_groups").update(parsed.data).eq("id", id).select("id").single()
    : await supabase.from("kg_groups").insert(parsed.data).select("id").single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Bunday nomli faol guruh mavjud", errors: { name: ["Bu nom band"] } };
    return { ok: false, message: dbErrorMessage(error) };
  }
  const teacherIds = fd.getAll("teacher_ids").map(String).filter(Boolean);
  if (fd.has("teachers_submitted")) {
    await supabase.from("group_teachers").delete().eq("group_id", data.id).not("employee_id", "in", `(${teacherIds.length ? teacherIds.join(",") : "00000000-0000-0000-0000-000000000000"})`);
    if (teacherIds.length) {
      const { error: tErr } = await supabase.from("group_teachers").upsert(teacherIds.map((t) => ({ group_id: data.id, employee_id: t })), { onConflict: "group_id,employee_id", ignoreDuplicates: true });
      if (tErr) return { ok: false, message: dbErrorMessage(tErr) };
    }
  }
  revalidatePath("/guruhlar");
  return { ok: true, message: id ? "Guruh yangilandi" : "Guruh yaratildi" };
}

export async function setGroupActive(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const id = zUuid().safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: "Guruh topilmadi" };
  const active = fd.get("active") === "true";
  const supabase = await createClient();
  if (!active) {
    const { count } = await supabase.from("children").select("id", { count: "exact", head: true }).eq("group_id", id.data).eq("status", "active");
    if ((count ?? 0) > 0) return { ok: false, message: `Guruhda ${count} ta faol bola bor. Avval ularni boshqa guruhga o'tkazing.` };
  }
  const { error } = await supabase.from("kg_groups").update({ is_active: active }).eq("id", id.data);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/guruhlar");
  return { ok: true, message: active ? "Guruh faollashtirildi" : "Guruh arxivlandi" };
}
