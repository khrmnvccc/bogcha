import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { sp } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { FaceScanner, type ScanKid } from "./scanner";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Yuz orqali belgilash") };
}

export default async function FaceCheckPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getI18n();
  const user = await requireUser(["director", "admin", "teacher"]);
  const params = await searchParams;
  const supabase = await createClient();
  const today = todayISO();

  let groupsQ = supabase.from("kg_groups").select("id, name").eq("is_active", true).order("name");
  if (user.profile.role === "teacher") {
    const { data: mine } = await supabase.from("group_teachers").select("group_id").eq("employee_id", user.employeeId ?? "00000000-0000-0000-0000-000000000000");
    groupsQ = groupsQ.in("id", (mine ?? []).map((m) => m.group_id));
  }
  const { data: groups } = await groupsQ;
  const groupId = sp(params.guruh) ?? groups?.[0]?.id;

  let kids: ScanKid[] = [];
  if (groupId) {
    const { data } = await supabase.from("children").select("id, full_name, photo_updated_at, face_consent")
      .eq("group_id", groupId).eq("status", "active").lte("enrollment_date", today).order("full_name");
    const ids = (data ?? []).map((k) => k.id);
    const { data: recs } = ids.length
      ? await supabase.from("child_attendance").select("child_id, status, arrived_at, left_at").eq("date", today).in("child_id", ids)
      : { data: [] };
    const m = new Map((recs ?? []).map((r) => [r.child_id as string, r]));
    kids = (data ?? []).map((k) => ({
      id: k.id, name: k.full_name, photo: k.photo_updated_at, consent: k.face_consent,
      status: m.get(k.id)?.status ?? null, arrivedAt: m.get(k.id)?.arrived_at ?? null, leftAt: m.get(k.id)?.left_at ?? null,
    }));
  }

  return (
    <div>
      <PageHeader title={t("Yuz orqali belgilash")} description={t("Kamerani bolaga qarating: tizim uni taniydi, siz tasdiqlaysiz")} back={{ href: "/davomat", label: "Bolalar davomati" }} />
      {groups && groups.length > 1 && (
        <div className="mb-4"><FilterBar filters={[{ type: "select", name: "guruh", label: "Guruh", options: groups.map((g) => ({ value: g.id, label: g.name })) }]} /></div>
      )}
      {!groupId ? <Card><EmptyState title={t("Guruh tanlanmagan")} /></Card>
        : kids.length === 0 ? <Card><EmptyState title={t("Guruhda faol bolalar yo'q")} /></Card>
        : <FaceScanner key={groupId} kids={kids} />}
    </div>
  );
}
