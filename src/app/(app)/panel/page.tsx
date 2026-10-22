import type { Metadata } from "next";
import Link from "next/link";
import { Baby, Users, UserCheck, UserX, Briefcase, Wallet, AlertCircle, Cake, Megaphone, Percent } from "lucide-react";
import { requireUser, ADMIN_ROLES, FINANCE_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ATTENDANCE_STATUS, PAYMENT_METHOD } from "@/lib/labels";
import { addDaysISO, addMonthsISO, currentMonthISO, formatDate, formatDateLong, formatDateTime, formatMonth, formatSom, formatTime, todayISO, weekdayName } from "@/lib/format";
import { PageHeader, StatCard, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RevenueChart, AttendanceChart, DebtChart } from "@/components/charts";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Boshqaruv paneli") };
}

function upcomingBirthdays(children: { id: string; full_name: string; birth_date: string; kg_groups: { name: string } | null }[], today: string, days = 14) {
  const out: { id: string; name: string; group?: string; date: string; age: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDaysISO(today, i);
    for (const c of children) {
      if (c.birth_date.slice(5) === d.slice(5)) {
        out.push({ id: c.id, name: c.full_name, group: c.kg_groups?.name, date: d, age: Number(d.slice(0, 4)) - Number(c.birth_date.slice(0, 4)) });
      }
    }
  }
  return out;
}

export default async function DashboardPage() {
  const { t, f } = await getI18n();
  const user = await requireUser(FINANCE_ROLES);
  const isAdmin = ADMIN_ROLES.includes(user.profile.role);
  const supabase = await createClient();
  const today = todayISO();
  const month = currentMonthISO();
  const nextMonth = addMonthsISO(month, 1);

  const [
    { count: childCount }, { data: children }, { data: revenue }, { data: monthPayments }, { data: openInvoices },
    { data: recentPayments }, { data: news },
  ] = await Promise.all([
    supabase.from("children").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("children").select("id, full_name, birth_date, kg_groups(name)").eq("status", "active"),
    supabase.rpc("stats_revenue_by_month", { p_months: 12 }),
    supabase.from("payments").select("amount").eq("is_void", false).gte("paid_on", month).lt("paid_on", nextMonth),
    supabase.from("invoices").select("balance, due_date, period").gt("balance", 0).lt("period", nextMonth),
    supabase.from("payments").select("id, amount, method, paid_on, receipt_number, created_at, children(full_name), invoices(period)").eq("is_void", false).order("created_at", { ascending: false }).limit(6),
    supabase.from("announcements").select("id, title, created_at, audience").order("created_at", { ascending: false }).limit(4),
  ]);

  const collected = (monthPayments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = (openInvoices ?? []).reduce((s, i) => s + Number(i.balance), 0);
  const overdue = (openInvoices ?? []).filter((i) => i.due_date < today);
  const thisMonthRev = (revenue ?? []).find((r: { period: string }) => r.period === month) as { expected: number; collected: number } | undefined;
  const rate = thisMonthRev && Number(thisMonthRev.expected) > 0 ? Math.round((Number(thisMonthRev.collected) / Number(thisMonthRev.expected)) * 100) : null;

  // Staff-only data (RLS hides it from accountants anyway).
  let staff = { employees: 0, atWork: 0, present: 0, absent: 0, unmarked: 0 };
  let trend: { day: string; present: number; late: number; absent: number; excused: number }[] = [];
  let activity: { id: string; when: string; text: string; status?: string }[] = [];
  if (isAdmin) {
    const [{ count: empCount }, { data: empToday }, { data: childToday }, { data: tr }, { data: recentChild }, { data: recentEmp }] = await Promise.all([
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("employee_attendance").select("check_out_at").eq("work_date", today),
      supabase.from("child_attendance").select("status").eq("date", today),
      supabase.rpc("stats_attendance_trend", { p_days: 30 }),
      supabase.from("child_attendance").select("id, status, updated_at, children(full_name)").order("updated_at", { ascending: false }).limit(6),
      supabase.from("employee_attendance").select("id, check_in_at, check_out_at, updated_at, employees(full_name)").order("updated_at", { ascending: false }).limit(6),
    ]);
    const ct = childToday ?? [];
    staff = {
      employees: empCount ?? 0,
      atWork: (empToday ?? []).filter((e) => !e.check_out_at).length,
      present: ct.filter((c) => c.status === "present" || c.status === "late").length,
      absent: ct.filter((c) => c.status === "absent" || c.status === "excused").length,
      unmarked: Math.max(0, (childCount ?? 0) - ct.length),
    };
    trend = ((tr ?? []) as typeof trend).map((t) => ({ ...t, present: Number(t.present), late: Number(t.late), absent: Number(t.absent), excused: Number(t.excused) }));
    type CA = { id: string; status: string; updated_at: string; children: { full_name: string } | null };
    type EA = { id: string; check_in_at: string; check_out_at: string | null; updated_at: string; employees: { full_name: string } | null };
    activity = [
      ...((recentChild ?? []) as unknown as CA[]).map((c) => ({ id: `c${c.id}`, when: c.updated_at, text: c.children?.full_name ?? "", status: c.status })),
      ...((recentEmp ?? []) as unknown as EA[]).map((e) => ({
        id: `e${e.id}`, when: e.updated_at,
        text: e.check_out_at
          ? t("{0} ishdan ketdi ({1})", [e.employees?.full_name ?? "", formatTime(e.check_out_at)])
          : t("{0} ishga keldi ({1})", [e.employees?.full_name ?? "", formatTime(e.check_in_at)]),
      })),
    ].sort((a, b) => b.when.localeCompare(a.when)).slice(0, 8);
  }

  const birthdays = upcomingBirthdays((children ?? []) as unknown as Parameters<typeof upcomingBirthdays>[0], today);
  const rev = ((revenue ?? []) as { period: string; expected: number; collected: number; outstanding: number }[]).map((r) => ({
    period: r.period, expected: Number(r.expected), collected: Number(r.collected), outstanding: Number(r.outstanding),
  }));
  type RP = { id: string; amount: number; method: string; paid_on: string; receipt_number: string; children: { full_name: string } | null; invoices: { period: string } | null };

  return (
    <div className="space-y-6">
      <PageHeader title={t("Boshqaruv paneli")} description={`${f.weekdayName(today)}, ${f.formatDateLong(today)}`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("Faol bolalar")} value={childCount ?? 0} icon={<Baby className="h-5 w-5" />} href="/bolalar" />
        {isAdmin && <StatCard label={t("Faol xodimlar")} value={staff.employees} icon={<Users className="h-5 w-5" />} tone="violet" href="/xodimlar" />}
        {isAdmin && <StatCard label={t("Bugun kelgan bolalar")} value={staff.present} icon={<UserCheck className="h-5 w-5" />} tone="green" href="/davomat" hint={staff.unmarked ? t("{0} ta belgilanmagan", [staff.unmarked]) : t("Hammasi belgilangan")} />}
        {isAdmin && <StatCard label={t("Bugun kelmagan bolalar")} value={staff.absent} icon={<UserX className="h-5 w-5" />} tone="red" href="/davomat" />}
        {isAdmin && <StatCard label={t("Hozir ishdagi xodimlar")} value={staff.atWork} icon={<Briefcase className="h-5 w-5" />} tone="blue" href="/ishga-kelish" />}
        <StatCard label={t("Shu oy yig'ilgan")} value={f.formatSom(collected)} icon={<Wallet className="h-5 w-5" />} tone="green" href="/tolovlar-tarixi" />
        <StatCard label={t("Umumiy qarzdorlik")} value={f.formatSom(outstanding)} icon={<AlertCircle className="h-5 w-5" />} tone="red" href="/tolovlar?holat=qarz" hint={t("{0} ta muddati o'tgan hisob", [overdue.length])} />
        <StatCard label={t("Yig'ish darajasi")} value={rate == null ? "—" : `${rate}%`} icon={<Percent className="h-5 w-5" />} tone="amber" hint={f.formatMonth(month)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("Oylik tushum")} description={t("Hisoblangan va yig'ilgan summa, oxirgi 12 oy")} />
          <CardBody>{rev.length ? <RevenueChart data={rev} /> : <EmptyState title={t("Ma'lumot yo'q")} />}</CardBody>
        </Card>
        {isAdmin ? (
          <Card>
            <CardHeader title={t("Bolalar davomati")} description={t("Oxirgi 30 kun")} />
            <CardBody>{trend.some((t) => t.present + t.late + t.absent + t.excused > 0) ? <AttendanceChart data={trend} /> : <EmptyState title={t("Hali davomat belgilanmagan")} />}</CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader title={t("To'lanmagan summa")} description={t("Oylar kesimida qolgan qarz")} />
            <CardBody>{rev.some((r) => r.outstanding > 0) ? <DebtChart data={rev} /> : <EmptyState title={t("Qarzdorlik yo'q")} />}</CardBody>
          </Card>
        )}
      </div>

      {isAdmin && (
        <Card>
          <CardHeader title={t("To'lanmagan summa")} description={t("Oylar kesimida qolgan qarz")} />
          <CardBody>{rev.some((r) => r.outstanding > 0) ? <DebtChart data={rev} /> : <EmptyState title={t("Qarzdorlik yo'q")} />}</CardBody>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("Oxirgi to'lovlar")} action={<Link href="/tolovlar-tarixi" className="text-sm text-brand-700">{t("Barchasi")}</Link>} />
          {(recentPayments ?? []).length === 0 ? <EmptyState title={t("Hali to'lovlar yo'q")} /> : (
            <ul className="divide-y divide-slate-100">
              {((recentPayments ?? []) as unknown as RP[]).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{p.children?.full_name}</p>
                    <p className="text-xs text-slate-500">{f.formatMonth(p.invoices?.period)} · {t(PAYMENT_METHOD[p.method])} · {p.receipt_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-mint-700">{f.formatSom(p.amount)}</p>
                    <p className="text-xs text-slate-400">{formatDate(p.paid_on)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title={t("Yaqin tug'ilgan kunlar")} description={t("Keyingi 14 kun")} />
            <CardBody className="space-y-3">
              {birthdays.length === 0 ? <p className="text-sm text-slate-500">{t("Yaqin kunlarda tug'ilgan kun yo'q")}</p> : birthdays.map((b) => (
                <div key={b.id + b.date} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600"><Cake className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{b.name}</p>
                    <p className="text-xs text-slate-500">{b.group ?? t("Guruhsiz")} · {b.age}{" "}{t("yosh")}</p>
                  </div>
                  <Badge tone={b.date === today ? "green" : "gray"}>{b.date === today ? t("Bugun") : formatDate(b.date).slice(0, 5)}</Badge>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("E'lonlar")} action={<Link href="/elonlar" className="text-sm text-brand-700">{t("Barchasi")}</Link>} />
            <CardBody className="space-y-3">
              {(news ?? []).length === 0 ? <p className="text-sm text-slate-500">{t("E'lonlar yo'q")}</p> : (news ?? []).map((n) => (
                <div key={n.id} className="flex gap-3">
                  <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  <div><p className="text-sm font-medium text-slate-900">{n.title}</p><p className="text-xs text-slate-400">{formatDateTime(n.created_at)}</p></div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader title={t("Oxirgi davomat harakatlari")} />
          {activity.length === 0 ? <EmptyState title={t("Hali harakatlar yo'q")} /> : (
            <ul className="divide-y divide-slate-100">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0 truncate text-slate-700">
                    {a.text}
                    {a.status && <Badge tone={ATTENDANCE_STATUS[a.status]?.tone} className="ml-2">{t(ATTENDANCE_STATUS[a.status]?.label ?? "")}</Badge>}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{formatDateTime(a.when)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
