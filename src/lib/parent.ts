import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ParentChild = { id: string; full_name: string; birth_date: string; status: string; photo_updated_at: string | null; face_consent: boolean; kg_groups: { name: string } | null };

/** Children linked to the signed-in parent. RLS already restricts rows; this only shapes the query. */
export async function getMyChildren(supabase: SupabaseClient, guardianId: string | null): Promise<ParentChild[]> {
  if (!guardianId) return [];
  const { data } = await supabase.from("child_guardians").select("children(id, full_name, birth_date, status, photo_updated_at, face_consent, kg_groups(name))").eq("guardian_id", guardianId);
  return ((data ?? []) as unknown as { children: ParentChild | null }[])
    .map((r) => r.children)
    .filter((c): c is ParentChild => Boolean(c))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}
