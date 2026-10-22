import type { Metadata } from "next";
import { requireUser, hasPermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { ScanFace } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { sp } from "@/lib/utils";
import { PageHeader, EmptyState, Notice } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { AttendanceSheet } from "./sheet";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Bolalar davomati") };
}

export default async function DailyAttendancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, f } = await getI18n();
  const user = await requireUser(["director", "admin", "teacher"]);
  const params = await searchParams;
  const supabase = await createClient();
  const today = todayISO();
  const rawDate = sp(params.sana) ?? today;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && rawDate <= today ? rawDate : today;
  const isTeacher = user.profile.role === "teacher";

  let groupsQ = supabase.from("kg_groups").select("id, name").eq("is_active", true).order("name");
  if (isTeacher) {
    const { data: mine } = await supabase.from("group_teachers").select("group_id").eq("employee_id", user.employeeId ?? "00000000-0000-0000-0000-000000000000");
    groupsQ = groupsQ.in("id", (mine ?? []).map((m) => m.group_id));
  }
  const { data: groups } = await groupsQ;
  const groupId = sp(params.guruh) ?? groups?.[0]?.id;

  const isPast = date < today;
  const canCorrect = !isTeacher || hasPermission(user, "attendance.correct");
  const editable = !isPast || canCorrect;

  let children: { id: string; full_name: string; status?: "present" | "absent" | "late" | "excused"; note?: string | null; photo?: string | null; parentNote?: string | null; arrivedAt?: string | null; leftAt?: string | null }[] = [];
  if (groupId) {
    const { data: kids } = await supabase.from("children").select("id, full_name, photo_updated_at").eq("group_id", groupId).eq("status", "active").lte("enrollment_date", date).order("full_name");
    const ids = (kids ?? []).map((k) => k.id);
    const [{ data: recs }, { data: reports }] = ids.length ? await Promise.all([
      supabase.from("child_attendance").select("child_id, status, note, arrived_at, left_at").eq("date", date).in("child_id", ids),
      supabase.from("absence_reports").select("child_id, note").eq("date", date).in("child_id", ids),
    ]) : [{ data: [] }, { data: [] }];
    const m = new Map((recs ?? []).map((r) => [r.child_id as string, r]));
    const rep = new Map((reports ?? []).map((r) => [r.child_id as string, (r.note as string | null) ?? ""]));
    children = (kids ?? []).map((k) => ({ id: k.id, full_name: k.full_name, status: m.get(k.id)?.status, note: m.get(k.id)?.note, photo: k.photo_updated_at, parentNote: rep.get(k.id), arrivedAt: m.get(k.id)?.arrived_at, leftAt: m.get(k.id)?.left_at }));
  }

  return (
    <div>
      <PageHeader title={t("Bolalar davomati")} description={`${f.weekdayName(date)}, ${f.formatDateLong(date)}`}
        actions={date === today && groupId ? <LinkButton href={`/davomat/yuz?guruh=${groupId}`}><ScanFace className="h-4 w-4" />{" "}{t("Yuz orqali belgilash")}</LinkButton> : undefined} />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <FilterBar filters={[
            { type: "date", name: "sana", label: "Sana", default: date },
            ...(groups && groups.length > 1 ? [{ type: "select" as const, name: "guruh", label: "Guruh", options: groups.map((g) => ({ value: g.id, label: g.name })) }] : []),
          ]} />
          {groups && groups.length === 1 && <p className="mt-2 text-sm font-medium text-slate-700">{t("Guruh:")}{" "}{groups[0].name}</p>}
        </div>
        {!groupId ? (
          <EmptyState title={t("Guruh tanlanmagan")} description={isTeacher ? t("Sizga hali guruh biriktirilmagan") : t("Avval guruh yarating")} />
        ) : children.length === 0 ? (
          <EmptyState title={t("Guruhda faol bolalar yo'q")} />
        ) : (
          <>
            {isPast && editable && <Notice tone="amber" className="m-4">{t("Siz o'tgan kun davomatini o'zgartiryapsiz. Har bir o'zgarish sabab bilan audit jurnaliga yoziladi.")}</Notice>}
            <AttendanceSheet key={`${groupId}-${date}`} date={date} kids={children} editable={editable} needsReason={isPast}
              lockedReason={!editable ? "O'tgan kunlar davomatini faqat administrator yoki ruxsat berilgan xodim tuzata oladi." : undefined} />
          </>
        )}
      </Card>
    </div>
  );
}
