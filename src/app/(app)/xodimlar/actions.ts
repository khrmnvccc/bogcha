"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { authorize, isUser, dbErrorMessage, fieldErrors, type ActionState } from "@/lib/actions";
import { createAccount, resetAccountPassword, setAccountActive } from "@/lib/accounts";
import { zText, zPhone, zDate, zOptDate, zOptTime, zOptText, zUsername, zCheckbox, zUuid } from "@/lib/validation";
import { ADMIN_ROLES } from "@/lib/auth";
import type { Role } from "@/lib/labels";

const employeeSchema = z.object({
  full_name: zText("F.I.Sh.", 3, 150),
  phone: zPhone,
  position: zText("Lavozim", 2, 100),
  start_date: zDate("Ishga kirgan sana"),
  end_date: zOptDate,
  status: z.enum(["active", "on_leave", "terminated"], { error: "Holatni tanlang" }),
  schedule_start: zOptTime,
  schedule_end: zOptTime,
  notes: zOptText(2000),
  work_days: z.array(z.coerce.number().int().min(1).max(7)).optional(),
});

function parseEmployee(fd: FormData) {
  const obj: Record<string, unknown> = Object.fromEntries(fd);
  const days = fd.getAll("work_days").map(String);
  obj.work_days = fd.get("custom_days") === "on" ? days : undefined;
  return employeeSchema.safeParse(obj);
}

const accountRoles = z.enum(["teacher", "accountant", "admin", "director"], { error: "Rolni tanlang" });

export async function createEmployee(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const parsed = parseEmployee(fd);
  if (!parsed.success) return fieldErrors(parsed.error);

  const wantAccount = fd.get("create_account") === "on";
  let account: { username: string; role: Role } | null = null;
  if (wantAccount) {
    const acc = z.object({ username: zUsername, role: accountRoles }).safeParse(Object.fromEntries(fd));
    if (!acc.success) return fieldErrors(acc.error);
    if (["admin", "director"].includes(acc.data.role) && user.profile.role !== "director") {
      return { ok: false, message: "Rahbar rolini faqat direktor bera oladi" };
    }
    account = acc.data;
  }

  const supabase = await createClient();
  const { work_days, ...rest } = parsed.data;
  const { data: emp, error } = await supabase
    .from("employees")
    .insert({ ...rest, work_days: work_days?.length ? work_days : null })
    .select("id")
    .single();
  if (error) return { ok: false, message: dbErrorMessage(error) };

  const groupIds = fd.getAll("group_ids").map(String).filter(Boolean);
  if (groupIds.length) {
    await supabase.from("group_teachers").insert(groupIds.map((g) => ({ group_id: g, employee_id: emp.id })));
  }

  let creds: Record<string, unknown> | undefined;
  if (account) {
    const res = await createAccount({
      username: account.username, fullName: parsed.data.full_name, role: account.role,
      phone: parsed.data.phone, createdBy: user.id,
    });
    if (!res.ok) {
      revalidatePath("/xodimlar");
      return { ok: false, message: `Xodim qo'shildi, lekin hisob yaratilmadi: ${res.message}` };
    }
    await supabase.from("employees").update({ profile_id: res.account.userId }).eq("id", emp.id);
    creds = { username: res.account.username, tempPassword: res.account.tempPassword, fullName: parsed.data.full_name };
  }

  revalidatePath("/xodimlar");
  return { ok: true, message: "Xodim qo'shildi", data: { id: emp.id, ...(creds ? { creds } : {}) } };
}

export async function updateEmployee(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const id = zUuid().safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: "Xodim topilmadi" };
  const parsed = parseEmployee(fd);
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { work_days, ...rest } = parsed.data;
  const { data: before } = await supabase.from("employees").select("profile_id, status").eq("id", id.data).single();
  const { error } = await supabase.from("employees").update({ ...rest, work_days: work_days?.length ? work_days : null }).eq("id", id.data);
  if (error) return { ok: false, message: dbErrorMessage(error) };

  // Keep the login in sync with employment status.
  if (before?.profile_id && before.status !== rest.status && (rest.status === "terminated" || before.status === "terminated")) {
    const active = rest.status !== "terminated";
    const { error: pErr } = await supabase.from("profiles").update({ is_active: active, full_name: rest.full_name }).eq("id", before.profile_id);
    if (!pErr) await setAccountActive(before.profile_id, active);
  } else if (before?.profile_id) {
    await supabase.from("profiles").update({ full_name: rest.full_name, phone: rest.phone }).eq("id", before.profile_id);
  }

  revalidatePath("/xodimlar");
  revalidatePath(`/xodimlar/${id.data}`);
  return { ok: true, message: "O'zgarishlar saqlandi" };
}

export async function setEmployeeGroups(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const id = zUuid().safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: "Xodim topilmadi" };
  const groupIds = fd.getAll("group_ids").map(String).filter(Boolean);
  const supabase = await createClient();
  const { data: current } = await supabase.from("group_teachers").select("group_id").eq("employee_id", id.data);
  const cur = new Set((current ?? []).map((r) => r.group_id as string));
  const next = new Set(groupIds);
  const toDel = [...cur].filter((g) => !next.has(g));
  const toAdd = [...next].filter((g) => !cur.has(g));
  if (toDel.length) {
    const { error } = await supabase.from("group_teachers").delete().eq("employee_id", id.data).in("group_id", toDel);
    if (error) return { ok: false, message: dbErrorMessage(error) };
  }
  if (toAdd.length) {
    const { error } = await supabase.from("group_teachers").insert(toAdd.map((g) => ({ group_id: g, employee_id: id.data })));
    if (error) return { ok: false, message: dbErrorMessage(error) };
  }
  revalidatePath(`/xodimlar/${id.data}`);
  return { ok: true, message: "Guruhlar yangilandi" };
}

export async function createEmployeeAccount(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const parsed = z.object({ id: zUuid(), username: zUsername, role: accountRoles }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fieldErrors(parsed.error);
  if (["admin", "director"].includes(parsed.data.role) && user.profile.role !== "director") {
    return { ok: false, message: "Rahbar rolini faqat direktor bera oladi" };
  }
  const supabase = await createClient();
  const { data: emp } = await supabase.from("employees").select("id, full_name, phone, profile_id").eq("id", parsed.data.id).single();
  if (!emp) return { ok: false, message: "Xodim topilmadi" };
  if (emp.profile_id) return { ok: false, message: "Bu xodimning hisobi allaqachon mavjud" };

  const res = await createAccount({ username: parsed.data.username, fullName: emp.full_name, role: parsed.data.role, phone: emp.phone, createdBy: user.id });
  if (!res.ok) return { ok: false, message: res.message };
  const { error } = await supabase.from("employees").update({ profile_id: res.account.userId }).eq("id", emp.id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(`/xodimlar/${emp.id}`);
  return { ok: true, message: "Hisob yaratildi", data: { creds: { username: res.account.username, tempPassword: res.account.tempPassword, fullName: emp.full_name } } };
}

/** Shared by employees and users pages. Only admins; only directors may touch leadership accounts. */
export async function resetPassword(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const id = zUuid().safeParse(fd.get("profile_id"));
  if (!id.success) return { ok: false, message: "Foydalanuvchi topilmadi" };
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("id, role, username, full_name").eq("id", id.data).single();
  if (!target) return { ok: false, message: "Foydalanuvchi topilmadi" };
  if (["director", "admin"].includes(target.role) && user.profile.role !== "director") {
    return { ok: false, message: "Rahbar hisobining parolini faqat direktor tiklay oladi" };
  }
  if (target.id === user.id) return { ok: false, message: "O'z parolingizni Profil sahifasida almashtiring" };
  const res = await resetAccountPassword(target.id);
  if (!res.ok) return { ok: false, message: res.message };
  return { ok: true, message: "Parol tiklandi", data: { creds: { username: target.username, tempPassword: res.tempPassword, fullName: target.full_name } } };
}

export async function setUserActive(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const parsed = z.object({ profile_id: zUuid(), active: zCheckbox }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, message: "Noto'g'ri so'rov" };
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("role").eq("id", parsed.data.profile_id).single();
  if (!target) return { ok: false, message: "Foydalanuvchi topilmadi" };
  if (["director", "admin"].includes(target.role) && user.profile.role !== "director") {
    return { ok: false, message: "Rahbar hisobini faqat direktor o'zgartira oladi" };
  }
  // RLS + DB trigger enforce: admins only, directors only for leadership, never yourself.
  const { error } = await supabase.from("profiles").update({ is_active: parsed.data.active }).eq("id", parsed.data.profile_id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  const res = await setAccountActive(parsed.data.profile_id, parsed.data.active);
  if (!res.ok) return { ok: false, message: res.message };
  revalidatePath("/foydalanuvchilar");
  revalidatePath("/xodimlar", "layout");
  return { ok: true, message: parsed.data.active ? "Hisob faollashtirildi" : "Hisob faolsizlantirildi" };
}
