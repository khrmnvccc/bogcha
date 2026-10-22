"use server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, ADMIN_ROLES, STAFF_ROLES } from "@/lib/auth";
import { safeSearch } from "@/lib/utils";

export type SearchHit = { kind: "child" | "employee"; id: string; name: string; sub: string | null; photo: string | null; href: string };

/** Quick search for the command palette. Rows come through RLS, so a teacher only finds their own groups. */
export async function quickSearch(raw: string): Promise<SearchHit[]> {
  const user = await getCurrentUser();
  const q = safeSearch(raw);
  if (!user || !user.profile.is_active || !q || q.length < 2 || !STAFF_ROLES.includes(user.profile.role)) return [];
  const supabase = await createClient();
  const isAdmin = ADMIN_ROLES.includes(user.profile.role);
  const [{ data: kids }, { data: staff }] = await Promise.all([
    supabase.from("children").select("id, full_name, photo_updated_at, status, kg_groups(name)").ilike("full_name", `%${q}%`).order("full_name").limit(8),
    isAdmin
      ? supabase.from("employees").select("id, full_name, position, photo_updated_at").or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`).order("full_name").limit(6)
      : Promise.resolve({ data: [] as { id: string; full_name: string; position: string; photo_updated_at: string | null }[] }),
  ]);
  return [
    ...((kids ?? []) as unknown as { id: string; full_name: string; photo_updated_at: string | null; kg_groups: { name: string } | null }[])
      .map((c) => ({ kind: "child" as const, id: c.id, name: c.full_name, sub: c.kg_groups?.name ?? null, photo: c.photo_updated_at, href: `/bolalar/${c.id}` })),
    ...(staff ?? []).map((e) => ({ kind: "employee" as const, id: e.id, name: e.full_name, sub: e.position, photo: e.photo_updated_at, href: `/xodimlar/${e.id}` })),
  ];
}
