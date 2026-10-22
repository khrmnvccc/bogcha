import "server-only";
import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { usernameToEmail } from "@/lib/auth";
import type { Role } from "@/lib/labels";

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Readable temporary password (no ambiguous characters), always has a letter and a digit. */
export function generateTempPassword(length = 10): string {
  for (;;) {
    let out = "";
    for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
    if (/[a-zA-Z]/.test(out) && /[0-9]/.test(out)) return out;
  }
}

export function suggestUsername(fullName: string): string {
  const map: Record<string, string> = { "o'": "o", "g'": "g", "ʻ": "", "'": "", sh: "sh", ch: "ch" };
  let s = fullName.toLowerCase();
  for (const [k, v] of Object.entries(map)) s = s.split(k).join(v);
  const parts = s.normalize("NFKD").replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).join(".") || "foydalanuvchi").slice(0, 30);
}

export type CreatedAccount = { userId: string; username: string; tempPassword: string };

/** Creates a Supabase Auth user. The profile row is created by a DB trigger from app_metadata. */
export async function createAccount(input: {
  username: string; fullName: string; role: Role; phone?: string | null; createdBy: string;
}): Promise<{ ok: true; account: CreatedAccount } | { ok: false; message: string }> {
  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data: existing } = await admin.from("profiles").select("id").eq("username", input.username).maybeSingle();
  if (existing) return { ok: false, message: "Bu login band. Boshqa login tanlang." };

  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(input.username),
    password: tempPassword,
    email_confirm: true,
    app_metadata: {
      role: input.role,
      full_name: input.fullName,
      username: input.username,
      phone: input.phone ?? null,
      must_change_password: true,
      created_by: input.createdBy,
    },
  });
  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes("already")) return { ok: false, message: "Bu login band. Boshqa login tanlang." };
    console.error("[accounts] createUser failed", error?.status);
    return { ok: false, message: "Hisob yaratib bo'lmadi. Qayta urinib ko'ring." };
  }
  return { ok: true, account: { userId: data.user.id, username: input.username, tempPassword } };
}

export async function resetAccountPassword(userId: string): Promise<{ ok: true; tempPassword: string } | { ok: false; message: string }> {
  const admin = createAdminClient();
  const tempPassword = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: tempPassword });
  if (error) return { ok: false, message: "Parolni tiklab bo'lmadi" };
  await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
  await admin.from("notifications").insert({
    user_id: userId, kind: "account", title: "Parolingiz tiklandi",
    body: "Administrator parolingizni tikladi. Keyingi kirishda yangi parol o'rnating.",
  });
  return { ok: true, tempPassword };
}

/** Activates/deactivates login. Deactivation also bans the auth user so existing sessions cannot refresh. */
export async function setAccountActive(userId: string, active: boolean) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  if (error) return { ok: false as const, message: "Hisob holatini o'zgartirib bo'lmadi" };
  return { ok: true as const };
}
