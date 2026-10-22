"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { homePathFor, usernameToEmail, getCurrentUser } from "@/lib/auth";
import { fieldErrors, type ActionState } from "@/lib/actions";
import { zPassword } from "@/lib/validation";
import type { Role } from "@/lib/labels";

const loginSchema = z.object({
  username: z.string().trim().min(3, "Loginni kiriting").max(120),
  password: z.string().min(1, "Parolni kiriting").max(72),
  next: z.string().optional(),
});

function safeNext(next: string | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

export async function signIn(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { username, password, next } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (error || !data.user) {
    if (error?.status === 429) return { ok: false, message: "Juda ko'p urinish. Bir necha daqiqadan so'ng qayta urinib ko'ring." };
    return { ok: false, message: "Login yoki parol noto'g'ri" };
  }

  const { data: profile } = await supabase.from("profiles").select("role, is_active, must_change_password").eq("id", data.user.id).maybeSingle();
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return { ok: false, message: "Hisobingiz faol emas. Administrator bilan bog'laning." };
  }
  if (profile.must_change_password) redirect("/parol-almashtirish");
  redirect(safeNext(next) ?? homePathFor(profile.role as Role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/kirish");
}

const changeSchema = z
  .object({
    current: z.string().min(1, "Joriy parolni kiriting"),
    password: zPassword,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Parollar mos kelmadi" })
  .refine((v) => v.password !== v.current, { path: ["password"], message: "Yangi parol eskisidan farq qilishi kerak" });

export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Tizimga qayta kiring" };
  const parsed = changeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { data: authUser } = await supabase.auth.getUser();
  const email = authUser.user?.email;
  if (!email) return { ok: false, message: "Tizimga qayta kiring" };

  // Re-verify the current password before changing it.
  const verify = await supabase.auth.signInWithPassword({ email, password: parsed.data.current });
  if (verify.error) return { ok: false, message: "Joriy parol noto'g'ri", errors: { current: ["Joriy parol noto'g'ri"] } };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: "Parolni o'zgartirib bo'lmadi. Boshqa parol tanlang." };

  await createAdminClient()
    .from("profiles")
    .update({ must_change_password: false, last_password_change_at: new Date().toISOString() })
    .eq("id", user.id);

  if (fd.get("forced") === "1") redirect(homePathFor(user.profile.role));
  return { ok: true, message: "Parol muvaffaqiyatli o'zgartirildi" };
}
