import type { Metadata } from "next";
import { requireUser, hasPermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateLong, todayISO, weekdayName } from "@/lib/format";
import { sp } from "@/lib/utils";
import { PageHeader, EmptyState, Notice } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { AttendanceSheet } from "./sheet";

export const metadata: Metadata = { title: "Bolalar davomati" };

export default async function DailyAttendancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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

  let children: { id: string; full_name: string; status?: "present" | "absent" | "late" | "excused"; note?: string | null }[] = [];
  if (groupId) {
    const { data: kids } = await supabase.from("children").select("id, full_name").eq("group_id", groupId).eq("status", "active").lte("enrollment_date", date).order("full_name");
    const ids = (kids ?? []).map((k) => k.id);
    const { data: recs } = ids.length ? await supabase.from("child_attendance").select("child_id, status, note").eq("date", date).in("child_id", ids) : { data: [] };
    const m = new Map((recs ?? []).map((r) => [r.child_id as string, r]));
    children = (kids ?? []).map((k) => ({ id: k.id, full_name: k.full_name, status: m.get(k.id)?.status, note: m.get(k.id)?.note }));
  }

  return (
    <div>
      <PageHeader title="Bolalar davomati" description={`${weekdayName(date)}, ${formatDateLong(date)}`} />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <FilterBar filters={[
            { type: "date", name: "sana", label: "Sana", default: date },
            ...(groups && groups.length > 1 ? [{ type: "select" as const, name: "guruh", label: "Guruh", options: groups.map((g) => ({ value: g.id, label: g.name })) }] : []),
          ]} />
          {groups && groups.length === 1 && <p className="mt-2 text-sm font-medium text-slate-700">Guruh: {groups[0].name}</p>}
        </div>
        {!groupId ? (
          <EmptyState title="Guruh tanlanmagan" description={isTeacher ? "Sizga hali guruh biriktirilmagan" : "Avval guruh yarating"} />
        ) : children.length === 0 ? (
          <EmptyState title="Guruhda faol bolalar yo'q" />
        ) : (
          <>
            {isPast && editable && <Notice tone="amber" className="m-4">Siz o&apos;tgan kun davomatini o&apos;zgartiryapsiz. Har bir o&apos;zgarish sabab bilan audit jurnaliga yoziladi.</Notice>}
            <AttendanceSheet key={`${groupId}-${date}`} date={date} kids={children} editable={editable} needsReason={isPast}
              lockedReason={!editable ? "O'tgan kunlar davomatini faqat administrator yoki ruxsat berilgan xodim tuzata oladi." : undefined} />
          </>
        )}
      </Card>
    </div>
  );
}
