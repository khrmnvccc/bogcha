"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { authorize, isUser, dbErrorMessage, fieldErrors, type ActionState } from "@/lib/actions";
import { createAccount } from "@/lib/accounts";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/auth";
import { zText, zDate, zOptDate, zOptMoney, zOptUuid, zPhone, zOptPhone, zOptText, zUsername, zUuid } from "@/lib/validation";
import { todayISO } from "@/lib/format";

const childSchema = z.object({
  full_name: zText("F.I.Sh.", 3, 150),
  birth_date: zDate("Tug'ilgan sana").refine((d) => d <= todayISO(), "Tug'ilgan sana kelajakda bo'lishi mumkin emas"),
  gender: z.enum(["male", "female"]).optional().or(z.literal("").transform(() => undefined)),
  group_id: zOptUuid,
  enrollment_date: zDate("Qabul qilingan sana"),
  leave_date: zOptDate,
  status: z.enum(["active", "paused", "left", "graduated"], { error: "Holatni tanlang" }),
  monthly_fee: zOptMoney,
}).refine((v) => v.birth_date <= v.enrollment_date, { path: ["enrollment_date"], message: "Qabul sanasi tug'ilgan sanadan keyin bo'lsin" });

const guardianSchema = z.object({
  g_full_name: zText("Ota-ona F.I.Sh.", 3, 150),
  g_phone: zPhone,
  g_phone2: zOptPhone,
  g_address: zOptText(300),
  g_workplace: zOptText(200),
  g_relationship: zText("Qarindoshligi", 2, 40),
});

function guardianRow(g: z.infer<typeof guardianSchema>) {
  return { full_name: g.g_full_name, phone: g.g_phone, phone2: g.g_phone2, address: g.g_address, workplace: g.g_workplace };
}

export async function createChild(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const raw = Object.fromEntries(fd);
  const child = childSchema.safeParse(raw);
  if (!child.success) return fieldErrors(child.error);

  const mode = String(fd.get("guardian_mode") ?? "new");
  let guardianId: string | null = null;
  let relationship = "ota-ona";
  let newGuardian: z.infer<typeof guardianSchema> | null = null;
  if (mode === "existing") {
    const g = z.object({ existing_guardian_id: zUuid("Ota-ona"), e_relationship: zText("Qarindoshligi", 2, 40) }).safeParse(raw);
    if (!g.success) return fieldErrors(g.error);
    guardianId = g.data.existing_guardian_id;
    relationship = g.data.e_relationship;
  } else if (mode === "new") {
    const g = guardianSchema.safeParse(raw);
    if (!g.success) return fieldErrors(g.error);
    newGuardian = g.data;
    relationship = g.data.g_relationship;
  }
  let username: string | null = null;
  if (newGuardian && fd.get("create_parent_account") === "on") {
    const u = zUsername.safeParse(fd.get("parent_username"));
    if (!u.success) return fieldErrors(new z.ZodError(u.error.issues.map((i) => ({ ...i, path: ["parent_username"] }))));
    username = u.data;
  }

  const supabase = await createClient();
  const { data: c, error } = await supabase.from("children").insert({ ...child.data, gender: child.data.gender ?? null }).select("id").single();
  if (error) return { ok: false, message: dbErrorMessage(error) };

  if (newGuardian) {
    const { data: g, error: gErr } = await supabase.from("guardians").insert(guardianRow(newGuardian)).select("id").single();
    if (gErr) return { ok: false, message: `Bola qo'shildi, lekin ota-ona saqlanmadi: ${dbErrorMessage(gErr)}`, data: { id: c.id } };
    guardianId = g.id;
  }
  if (guardianId) {
    const { error: lErr } = await supabase.from("child_guardians").insert({ child_id: c.id, guardian_id: guardianId, relationship, is_primary: true });
    if (lErr) return { ok: false, message: dbErrorMessage(lErr), data: { id: c.id } };
  }

  let creds: Record<string, unknown> | undefined;
  if (username && guardianId && newGuardian) {
    const res = await createAccount({ username, fullName: newGuardian.g_full_name, role: "parent", phone: newGuardian.g_phone, createdBy: user.id });
    if (!res.ok) {
      revalidatePath("/bolalar");
      return { ok: true, message: `Bola qo'shildi. Ota-ona hisobi yaratilmadi: ${res.message}`, data: { id: c.id } };
    }
    await supabase.from("guardians").update({ profile_id: res.account.userId }).eq("id", guardianId);
    creds = { username, tempPassword: res.account.tempPassword, fullName: newGuardian.g_full_name };
  }
  revalidatePath("/bolalar");
  return { ok: true, message: "Bola qo'shildi", data: { id: c.id, ...(creds ? { creds } : {}) } };
}

export async function updateChild(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const id = zUuid().safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: "Bola topilmadi" };
  const parsed = childSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fieldErrors(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("children").update({ ...parsed.data, gender: parsed.data.gender ?? null }).eq("id", id.data);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(`/bolalar/${id.data}`);
  revalidatePath("/bolalar");
  return { ok: true, message: "Ma'lumotlar saqlandi" };
}

export async function addGuardian(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const childId = zUuid().safeParse(fd.get("child_id"));
  if (!childId.success) return { ok: false, message: "Bola topilmadi" };
  const raw = Object.fromEntries(fd);
  const supabase = await createClient();
  let guardianId: string;
  let relationship: string;
  if (fd.get("guardian_mode") === "existing") {
    const g = z.object({ existing_guardian_id: zUuid("Ota-ona"), e_relationship: zText("Qarindoshligi", 2, 40) }).safeParse(raw);
    if (!g.success) return fieldErrors(g.error);
    guardianId = g.data.existing_guardian_id;
    relationship = g.data.e_relationship;
  } else {
    const g = guardianSchema.safeParse(raw);
    if (!g.success) return fieldErrors(g.error);
    const { data, error } = await supabase.from("guardians").insert(guardianRow(g.data)).select("id").single();
    if (error) return { ok: false, message: dbErrorMessage(error) };
    guardianId = data.id;
    relationship = g.data.g_relationship;
  }
  const { count } = await supabase.from("child_guardians").select("guardian_id", { count: "exact", head: true }).eq("child_id", childId.data);
  const { error } = await supabase.from("child_guardians").insert({
    child_id: childId.data, guardian_id: guardianId, relationship, is_primary: (count ?? 0) === 0, can_pickup: fd.get("can_pickup") !== "off",
  });
  if (error) return { ok: false, message: error.code === "23505" ? "Bu ota-ona allaqachon bog'langan" : dbErrorMessage(error) };
  revalidatePath(`/bolalar/${childId.data}`);
  return { ok: true, message: "Ota-ona bog'landi" };
}

export async function updateGuardian(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const id = zUuid().safeParse(fd.get("guardian_id"));
  const childId = zUuid().safeParse(fd.get("child_id"));
  if (!id.success || !childId.success) return { ok: false, message: "Topilmadi" };
  const g = guardianSchema.extend({ telegram_chat_id: z.string().trim().regex(/^-?\d{0,20}$/, "Faqat raqam").optional() }).safeParse(Object.fromEntries(fd));
  if (!g.success) return fieldErrors(g.error);
  const supabase = await createClient();
  const { error } = await supabase.from("guardians").update({ ...guardianRow(g.data), telegram_chat_id: g.data.telegram_chat_id || null }).eq("id", id.data);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  await supabase.from("child_guardians").update({ relationship: g.data.g_relationship, can_pickup: fd.get("can_pickup") === "on" })
    .eq("child_id", childId.data).eq("guardian_id", id.data);
  revalidatePath(`/bolalar/${childId.data}`);
  return { ok: true, message: "Ota-ona ma'lumotlari saqlandi" };
}

export async function unlinkGuardian(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const p = z.object({ child_id: zUuid(), guardian_id: zUuid() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: "Topilmadi" };
  const supabase = await createClient();
  const { error } = await supabase.from("child_guardians").delete().eq("child_id", p.data.child_id).eq("guardian_id", p.data.guardian_id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(`/bolalar/${p.data.child_id}`);
  return { ok: true, message: "Bog'lanish olib tashlandi. Ota-ona endi bu bolaning ma'lumotlarini ko'rmaydi." };
}

export async function createParentAccount(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const p = z.object({ guardian_id: zUuid(), username: zUsername }).safeParse(Object.fromEntries(fd));
  if (!p.success) return fieldErrors(p.error);
  const supabase = await createClient();
  const { data: g } = await supabase.from("guardians").select("id, full_name, phone, profile_id").eq("id", p.data.guardian_id).single();
  if (!g) return { ok: false, message: "Ota-ona topilmadi" };
  if (g.profile_id) return { ok: false, message: "Bu ota-onaning hisobi allaqachon mavjud" };
  const res = await createAccount({ username: p.data.username, fullName: g.full_name, role: "parent", phone: g.phone, createdBy: user.id });
  if (!res.ok) return { ok: false, message: res.message };
  const { error } = await supabase.from("guardians").update({ profile_id: res.account.userId }).eq("id", g.id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/bolalar", "layout");
  revalidatePath("/foydalanuvchilar");
  return { ok: true, message: "Ota-ona hisobi yaratildi", data: { creds: { username: res.account.username, tempPassword: res.account.tempPassword, fullName: g.full_name } } };
}

export async function addPickup(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const p = z.object({ child_id: zUuid(), full_name: zText("F.I.Sh.", 3, 150), relationship: zText("Kimligi", 2, 40), phone: zPhone }).safeParse(Object.fromEntries(fd));
  if (!p.success) return fieldErrors(p.error);
  const supabase = await createClient();
  const { error } = await supabase.from("pickup_contacts").insert(p.data);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(`/bolalar/${p.data.child_id}`);
  return { ok: true, message: "Olib ketuvchi qo'shildi" };
}

export async function removePickup(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const p = z.object({ id: zUuid(), child_id: zUuid() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: "Topilmadi" };
  const supabase = await createClient();
  const { error } = await supabase.from("pickup_contacts").delete().eq("id", p.data.id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(`/bolalar/${p.data.child_id}`);
  return { ok: true, message: "O'chirildi" };
}

export async function addNote(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(STAFF_ROLES.filter((r) => r !== "accountant"));
  if (!isUser(user)) return user;
  const p = z.object({
    child_id: zUuid(),
    category: z.enum(["general", "medical", "allergy", "behavior", "family"]),
    body: zText("Izoh", 1, 4000),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return fieldErrors(p.error);
  const supabase = await createClient();
  const { error } = await supabase.from("child_notes").insert({ ...p.data, created_by: user.id });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(`/bolalar/${p.data.child_id}`);
  return { ok: true, message: "Izoh qo'shildi" };
}

export async function deleteNote(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const p = z.object({ id: zUuid(), child_id: zUuid() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: "Topilmadi" };
  const supabase = await createClient();
  const { error } = await supabase.from("child_notes").delete().eq("id", p.data.id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(`/bolalar/${p.data.child_id}`);
  return { ok: true, message: "Izoh o'chirildi" };
}
