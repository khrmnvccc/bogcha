import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/labels";
import { env } from "@/lib/env";

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  username: string | null;
  phone: string | null;
  permissions: string[];
  is_active: boolean;
  must_change_password: boolean;
  telegram_linked_at: string | null;
};

export type CurrentUser = {
  id: string;
  profile: Profile;
  employeeId: string | null;
  guardianId: string | null;
};

export const ADMIN_ROLES: Role[] = ["director", "admin"];
export const FINANCE_ROLES: Role[] = ["director", "admin", "accountant"];
export const STAFF_ROLES: Role[] = ["director", "admin", "teacher", "accountant"];

/** Current user, verified against Supabase Auth. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  await connection(); // always per-request, never prerendered
  if (!env.isConfigured()) return null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const [{ data: profile }, { data: employee }, { data: guardian }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, full_name, username, phone, permissions, is_active, must_change_password, telegram_linked_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("employees").select("id").eq("profile_id", userId).maybeSingle(),
    supabase.from("guardians").select("id").eq("profile_id", userId).maybeSingle(),
  ]);
  if (!profile) return null;
  return {
    id: userId,
    profile: profile as Profile,
    employeeId: employee?.id ?? null,
    guardianId: guardian?.id ?? null,
  };
});

/** For pages: redirects to login or home when access is not allowed. */
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/kirish");
  if (!user.profile.is_active) redirect("/kirish?xato=faol-emas");
  if (roles && !roles.includes(user.profile.role)) redirect("/");
  return user;
}

export function hasPermission(user: CurrentUser, perm: string): boolean {
  return ADMIN_ROLES.includes(user.profile.role) || user.profile.permissions.includes(perm);
}

export function canViewFinance(user: CurrentUser): boolean {
  return FINANCE_ROLES.includes(user.profile.role) || user.profile.permissions.includes("finance.view");
}

export function homePathFor(role: Role): string {
  switch (role) {
    case "parent":
      return "/ota-ona";
    case "teacher":
      return "/mening-kunim";
    default:
      return "/panel";
  }
}

export function usernameToEmail(username: string): string {
  return username.includes("@") ? username.toLowerCase() : `${username.toLowerCase()}@${env.authEmailDomain()}`;
}
