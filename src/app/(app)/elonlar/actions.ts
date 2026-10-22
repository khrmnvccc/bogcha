"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { dispatchPending, anyChannelConfigured } from "@/lib/integrations/dispatch";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { authorize, isUser, dbErrorMessage, fieldErrors, type ActionState } from "@/lib/actions";
import { ADMIN_ROLES } from "@/lib/auth";
import { zText, zOptUuid, zUuid } from "@/lib/validation";

const schema = z.object({
  title: zText("Sarlavha", 3, 200),
  body: zText("Matn", 1, 5000),
  audience: z.enum(["everyone", "all_parents", "all_staff", "group", "guardian"], { error: "Kimga yuborilishini tanlang" }),
  group_id: zOptUuid,
  guardian_id: zOptUuid,
  is_pinned: z.string().optional().transform((v) => v === "on"),
}).superRefine((v, ctx) => {
  if (v.audience === "group" && !v.group_id) ctx.addIssue({ code: "custom", path: ["group_id"], message: "Guruhni tanlang" });
  if (v.audience === "guardian" && !v.guardian_id) ctx.addIssue({ code: "custom", path: ["guardian_id"], message: "Ota-onani tanlang" });
});

export async function publishAnnouncement(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES, "announcements.publish");
  if (!isUser(user)) return user;
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fieldErrors(p.error);
  const v = p.data;
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    title: v.title, body: v.body, audience: v.audience, is_pinned: v.is_pinned,
    group_id: v.audience === "group" ? v.group_id : null,
    guardian_id: v.audience === "guardian" ? v.guardian_id : null,
    created_by: user.id,
  });
  if (error) return { ok: false, message: error.code === "42501" ? "Siz faqat o'z guruhingizga e'lon yubora olasiz" : dbErrorMessage(error) };
  revalidatePath("/elonlar");
  if (anyChannelConfigured()) after(() => dispatchPending().then(() => undefined));
  return { ok: true, message: "E'lon e'lon qilindi va bildirishnomalar yuborildi" };
}

export async function deleteAnnouncement(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(null);
  if (!isUser(user)) return user;
  const id = zUuid().safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: "Topilmadi" };
  const supabase = await createClient();
  const { error, count } = await supabase.from("announcements").delete({ count: "exact" }).eq("id", id.data);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!count) return { ok: false, message: "O'chirishga ruxsat yo'q" };
  revalidatePath("/elonlar");
  return { ok: true, message: "E'lon o'chirildi" };
}

export async function togglePin(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const id = zUuid().safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: "Topilmadi" };
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").update({ is_pinned: fd.get("pinned") === "true" }).eq("id", id.data);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/elonlar");
  return { ok: true, message: "Yangilandi" };
}
