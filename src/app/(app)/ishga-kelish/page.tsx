import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Clock, UserCheck, UserX, Users, TimerOff } from "lucide-react";
import { requireUser, STAFF_ROLES, ADMIN_ROLES, type CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings, isExpectedOn, type EmployeeLite } from "@/lib/queries";
import { ATTENDANCE_SOURCE } from "@/lib/labels";
import { addDaysISO, currentMonthISO, formatDate, formatMinutes, formatTime, todayISO, weekdayName, formatHours } from "@/lib/format";
import { sp } from "@/lib/utils";
import { PageHeader, StatCard, EmptyState, Notice } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { FilterBar } from "@/components/ui/filter-bar";
import { LinkButton } from "@/components/ui/button";
import { AttendanceEditor, ReviewButton } from "./admin-tools";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Ishga kelish-ketish") };
}

type Rec = {
  id: string; employee_id: string; work_date: string; check_in_at: string; check_out_at: string | null;
  check_in_source: string; check_out_source: string | null; late_minutes: number; early_leave_minutes: number;
  worked_minutes: number | null; review_status: string; review_reasons: string[]; is_corrected: boolean; note: string | null;
  employees?: { full_name: string; position: string } | null;
};

type SP = Record<string, string | string[] | undefined>;

export default async function AttendancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser(STAFF_ROLES);
  const params = await searchParams;
  if (ADMIN_ROLES.includes(user.profile.role)) return <AdminView params={params} />;
  return <OwnHistory user={user} />;
}

async function Flags({ r, today }: { r: Rec; today: string }) {
  const { t } = await getI18n();
  return (
    <div className="flex flex-wrap gap-1">
      {r.late_minutes > 0 && <Badge tone="amber">{r.late_minutes}{" "}{t("daq kechikdi")}</Badge>}
      {r.early_leave_minutes > 0 && <Badge tone="amber">{r.early_leave_minutes}{" "}{t("daq erta ketdi")}</Badge>}
      {!r.check_out_at && r.work_date < today && <Badge tone="red">{t("Ketish belgilanmagan")}</Badge>}
      {r.review_status === "needs_review" && <Badge tone="red" title={r.review_reasons.join(", ")}>{t("Tekshirish kerak")}</Badge>}
      {r.review_status === "reviewed" && <Badge tone="gray">{t("Ko'rib chiqilgan")}</Badge>}
      {r.is_corrected && <Badge tone="violet" title={r.note ?? undefined}>{t("Tuzatilgan")}</Badge>}
    </div>
  );
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null;
  const s = ATTENDANCE_SOURCE[source];
  return <Badge tone={s?.tone} title={s?.hint}>{s?.label}</Badge>;
}

async function AdminView({ params }: { params: SP }) {
  const { t, f } = await getI18n();
  const supabase = await createClient();
  const today = todayISO();
  const from = sp(params.dan) ?? today;
  const to = sp(params.gacha) ?? (sp(params.dan) ? today : today);
  const employeeId = sp(params.xodim);
  const status = sp(params.holat);

  let q = supabase.from("employee_attendance").select("*, employees(full_name, position)")
    .gte("work_date", from).lte("work_date", to)
    .order("work_date", { ascending: false }).order("check_in_at", { ascending: false }).limit(1000);
  if (employeeId) q = q.eq("employee_id", employeeId);
  if (status === "kechikkan") q = q.gt("late_minutes", 0);
  if (status === "erta") q = q.gt("early_leave_minutes", 0);
  if (status === "belgilanmagan") q = q.is("check_out_at", null).lt("work_date", today);
  if (status === "tekshirish") q = q.eq("review_status", "needs_review");
  if (status === "tuzatilgan") q = q.eq("is_corrected", true);

  const [{ data }, settings, { data: emps }, { data: todayRecs }] = await Promise.all([
    q,
    getSettings(supabase),
    supabase.from("employees").select("id, full_name, position, status, schedule_start, schedule_end, work_days, profile_id").neq("status", "terminated").order("full_name"),
    supabase.from("employee_attendance").select("employee_id, check_out_at, late_minutes, review_status").eq("work_date", today),
  ]);
  const records = (data ?? []) as Rec[];
  const employees = (emps ?? []) as EmployeeLite[];
  const todayMap = new Map((todayRecs ?? []).map((r) => [r.employee_id as string, r]));
  const expected = employees.filter((e) => isExpectedOn(e, settings, today));
  const absentToday = expected.filter((e) => !todayMap.has(e.id));
  const { count: incomplete } = await supabase.from("employee_attendance").select("id", { count: "exact", head: true })
    .is("check_out_at", null).lt("work_date", today).neq("review_status", "reviewed");
  const { count: needsReview } = await supabase.from("employee_attendance").select("id", { count: "exact", head: true }).eq("review_status", "needs_review");

  const totalMin = records.reduce((s, r) => s + (r.worked_minutes ?? 0), 0);
  const showAbsent = status === "kelmagan";

  return (
    <div>
      <PageHeader
        title={t("Ishga kelish-ketish")}
        description={t("Xodimlarning kelish va ketish vaqtlari. Vaqtlar serverda, Toshkent vaqti bilan qayd etiladi.")}
        actions={<>
          <LinkButton variant="outline" href={`/hisobotlar?tur=xodimlar-davomati&oy=${currentMonthISO().slice(0, 7)}`}>{t("Oylik hisobot")}</LinkButton>
          <AttendanceEditor employees={employees} />
        </>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label={t("Bugun kutilmoqda")} value={expected.length} icon={<Users className="h-5 w-5" />} />
        <StatCard label={t("Hozir ishda")} value={(todayRecs ?? []).filter((r) => !r.check_out_at).length} icon={<UserCheck className="h-5 w-5" />} tone="green" />
        <StatCard label={t("Kelmagan")} value={absentToday.length} icon={<UserX className="h-5 w-5" />} tone="red" href="/ishga-kelish?holat=kelmagan" />
        <StatCard label={t("Kechikkan")} value={(todayRecs ?? []).filter((r) => r.late_minutes > 0).length} icon={<Clock className="h-5 w-5" />} tone="amber" href={`/ishga-kelish?holat=kechikkan`} />
        <StatCard label={t("Chala yozuvlar")} value={incomplete ?? 0} icon={<TimerOff className="h-5 w-5" />} tone="violet" href={`/ishga-kelish?holat=belgilanmagan&dan=${addDaysISO(today, -30)}`} />
      </div>
      {(needsReview ?? 0) > 0 && (
        <Notice tone="amber" className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{needsReview}{" "}{t("ta yozuv tekshirishni talab qiladi.")}{" "}
            <Link className="font-medium underline" href={`/ishga-kelish?holat=tekshirish&dan=${addDaysISO(today, -60)}`}>{t("Ko'rish")}</Link></span>
        </Notice>
      )}
      <Card>
        <div className="border-b border-slate-100 p-4">
          <FilterBar filters={[
            { type: "date", name: "dan", label: "Dan" },
            { type: "date", name: "gacha", label: "Gacha" },
            { type: "select", name: "xodim", label: "Xodim", options: employees.map((e) => ({ value: e.id, label: e.full_name })) },
            { type: "select", name: "holat", label: "Holat", options: [
              { value: "kelmagan", label: "Bugun kelmaganlar" },
              { value: "kechikkan", label: "Kechikkanlar" },
              { value: "erta", label: "Erta ketganlar" },
              { value: "belgilanmagan", label: "Ketish belgilanmagan" },
              { value: "tekshirish", label: "Tekshirish kerak" },
              { value: "tuzatilgan", label: "Tuzatilgan" },
            ] },
          ]} />
        </div>
        {showAbsent ? (
          absentToday.length === 0 ? <EmptyState title={t("Bugun barcha kutilgan xodimlar kelgan")} /> : (
            <Table>
              <THead><tr><TH>{t("Xodim")}</TH><TH>{t("Lavozim")}</TH><TH>{t("Ish boshlanishi")}</TH></tr></THead>
              <tbody>
                {absentToday.map((e) => (
                  <TR key={e.id}>
                    <TD><Link href={`/xodimlar/${e.id}`} className="font-medium hover:text-brand-700">{e.full_name}</Link></TD>
                    <TD>{e.position}</TD>
                    <TD>{(e.schedule_start ?? settings.work_start).slice(0, 5)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )
        ) : records.length === 0 ? (
          <EmptyState title={t("Yozuvlar topilmadi")} description={t("Sana oralig'ini yoki filtrlarni o'zgartiring")} />
        ) : (
          <>
            <Table>
              <THead><tr><TH>{t("Sana")}</TH><TH>{t("Xodim")}</TH><TH>{t("Keldi")}</TH><TH>{t("Ketdi")}</TH><TH>{t("Ishladi")}</TH><TH>{t("Belgilar")}</TH><TH className="text-right">{t("Amallar")}</TH></tr></THead>
              <tbody>
                {records.map((r) => (
                  <TR key={r.id}>
                    <TD className="whitespace-nowrap">{formatDate(r.work_date)}<p className="text-xs text-slate-400">{f.weekdayName(r.work_date)}</p></TD>
                    <TD><Link href={`/xodimlar/${r.employee_id}`} className="font-medium hover:text-brand-700">{r.employees?.full_name}</Link></TD>
                    <TD className="whitespace-nowrap">{formatTime(r.check_in_at)}<div className="mt-1"><SourceBadge source={r.check_in_source} /></div></TD>
                    <TD className="whitespace-nowrap">{r.check_out_at ? <>{formatTime(r.check_out_at)}<div className="mt-1"><SourceBadge source={r.check_out_source} /></div></> : "—"}</TD>
                    <TD className="whitespace-nowrap">{f.formatMinutes(r.worked_minutes)}</TD>
                    <TD><Flags r={r} today={today} /></TD>
                    <TD className="whitespace-nowrap text-right">
                      <AttendanceEditor employees={employees} initial={{
                        employee_id: r.employee_id, work_date: r.work_date,
                        check_in: formatTime(r.check_in_at), check_out: r.check_out_at ? formatTime(r.check_out_at) : "",
                      }} />
                      {r.review_status === "needs_review" && <ReviewButton id={r.id} />}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
              {records.length}{" "}{t("ta yozuv · Jami ishlangan vaqt:")}{" "}<b>{f.formatMinutes(totalMin)}</b>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

async function OwnHistory({ user }: { user: CurrentUser }) {
  const { t, f } = await getI18n();
  if (!user.employeeId) {
    return (
      <div>
        <PageHeader title={t("Ishga kelish-ketish")} />
        <Notice tone="amber">{t("Hisobingiz xodim kartasiga bog'lanmagan. Administratorga murojaat qiling.")}</Notice>
      </div>
    );
  }
  const supabase = await createClient();
  const today = todayISO();
  const month = currentMonthISO();
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weekStart = addDaysISO(today, -dow);
  const from = weekStart < month ? weekStart : month;
  const { data } = await supabase.from("employee_attendance").select("*").eq("employee_id", user.employeeId)
    .gte("work_date", addDaysISO(from, -62)).order("work_date", { ascending: false });
  const recs = (data ?? []) as Rec[];
  const sum = (f: (r: Rec) => boolean) => recs.filter(f).reduce((s, r) => s + (r.worked_minutes ?? 0), 0);

  return (
    <div>
      <PageHeader title={t("Mening davomatim")} description={t("Kelish-ketish vaqtlaringiz va ishlagan soatlaringiz. Vaqtlarni faqat administrator tuzata oladi.")} />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t("Bugun")} value={f.formatHours(sum((r) => r.work_date === today))} icon={<Clock className="h-5 w-5" />} />
        <StatCard label={t("Shu hafta")} value={f.formatHours(sum((r) => r.work_date >= weekStart))} icon={<Clock className="h-5 w-5" />} tone="violet" />
        <StatCard label={t("Shu oy")} value={f.formatHours(sum((r) => r.work_date >= month))} icon={<Clock className="h-5 w-5" />} tone="green"
          hint={t("{0} marta kechikish", [recs.filter((r) => r.work_date >= month && r.late_minutes > 0).length])} />
      </div>
      <Card>
        <CardHeader title={t("Oxirgi yozuvlar")} description={t("So'nggi 2 oy")} />
        {recs.length === 0 ? <EmptyState title={t("Hali yozuvlar yo'q")} /> : (
          <Table>
            <THead><tr><TH>{t("Sana")}</TH><TH>{t("Keldi")}</TH><TH>{t("Ketdi")}</TH><TH>{t("Ishladi")}</TH><TH>{t("Belgilar")}</TH></tr></THead>
            <tbody>
              {recs.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap">{formatDate(r.work_date)} <span className="text-xs text-slate-400">{f.weekdayName(r.work_date)}</span></TD>
                  <TD>{formatTime(r.check_in_at)} <SourceBadge source={r.check_in_source} /></TD>
                  <TD>{r.check_out_at ? formatTime(r.check_out_at) : "—"}</TD>
                  <TD>{f.formatMinutes(r.worked_minutes)}</TD>
                  <TD><Flags r={r} today={today} /></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
