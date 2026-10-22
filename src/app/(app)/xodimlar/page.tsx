import type { Metadata } from "next";
import Link from "next/link";
import { Users, UserCheck, Clock, UserX } from "lucide-react";
import { requireUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings, isExpectedOn, type EmployeeLite } from "@/lib/queries";
import { EMPLOYMENT_STATUS } from "@/lib/labels";
import { formatDate, formatTime, todayISO } from "@/lib/format";
import { safeSearch, sp } from "@/lib/utils";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { FilterBar } from "@/components/ui/filter-bar";
import { CreateEmployee } from "./create-employee";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Xodimlar") };
}

type Row = EmployeeLite & {
  phone: string | null; start_date: string;
  group_teachers: { kg_groups: { name: string } | null }[];
  profiles: { username: string | null; is_active: boolean } | null;
};

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getI18n();
  const user = await requireUser(ADMIN_ROLES);
  const params = await searchParams;
  const supabase = await createClient();
  const q = safeSearch(sp(params.q));
  const status = sp(params.holat);
  const today = todayISO();

  let query = supabase
    .from("employees")
    .select("id, full_name, phone, position, status, start_date, schedule_start, schedule_end, work_days, profile_id, group_teachers(kg_groups(name)), profiles(username, is_active)")
    .order("full_name");
  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,position.ilike.%${q}%`);
  if (status) query = query.eq("status", status);

  const [{ data }, settings, { data: groups }, { data: todayAtt }, { data: allActive }] = await Promise.all([
    query,
    getSettings(supabase),
    supabase.from("kg_groups").select("id, name").eq("is_active", true).order("name"),
    supabase.from("employee_attendance").select("employee_id, check_in_at, check_out_at, late_minutes").eq("work_date", today),
    supabase.from("employees").select("id, full_name, position, status, schedule_start, schedule_end, work_days, profile_id").eq("status", "active"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const att = new Map((todayAtt ?? []).map((a) => [a.employee_id as string, a]));
  const expected = ((allActive ?? []) as EmployeeLite[]).filter((e) => isExpectedOn(e, settings, today));
  const atWork = (todayAtt ?? []).filter((a) => a.check_in_at && !a.check_out_at).length;
  const absent = expected.filter((e) => !att.has(e.id)).length;

  return (
    <div>
      <PageHeader
        title={t("Xodimlar")}
        description={t("Xodimlar ro'yxati, lavozimlari va tizimga kirish hisoblari")}
        actions={<CreateEmployee groups={groups ?? []} canLeadership={user.profile.role === "director"}
          defaults={{ start: settings.work_start.slice(0, 5), end: settings.work_end.slice(0, 5), days: settings.work_days }} />}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("Faol xodimlar")} value={allActive?.length ?? 0} icon={<Users className="h-5 w-5" />} />
        <StatCard label={t("Bugun kutilmoqda")} value={expected.length} icon={<Clock className="h-5 w-5" />} tone="violet" />
        <StatCard label={t("Hozir ishda")} value={atWork} icon={<UserCheck className="h-5 w-5" />} tone="green" href="/ishga-kelish" />
        <StatCard label={t("Bugun kelmagan")} value={absent} icon={<UserX className="h-5 w-5" />} tone="red" href="/ishga-kelish?holat=kelmagan" />
      </div>
      <Card>
        <div className="border-b border-slate-100 p-4">
          <FilterBar filters={[
            { type: "search", name: "q", placeholder: "Ism, telefon yoki lavozim" },
            { type: "select", name: "holat", label: "Holat", options: Object.entries(EMPLOYMENT_STATUS).map(([value, v]) => ({ value, label: v.label })) },
          ]} />
        </div>
        {rows.length === 0 ? (
          <EmptyState title={t("Xodimlar topilmadi")} description={q || status ? t("Filtrlarni o'zgartirib ko'ring") : t("Birinchi xodimni qo'shing")} />
        ) : (
          <Table>
            <THead>
              <tr><TH>{t("Xodim")}</TH><TH>{t("Telefon")}</TH><TH>{t("Guruhlar")}</TH><TH>{t("Ish boshlagan")}</TH><TH>{t("Bugun")}</TH><TH>{t("Hisob")}</TH><TH>{t("Holat")}</TH></tr>
            </THead>
            <tbody>
              {rows.map((e) => {
                const a = att.get(e.id);
                return (
                  <TR key={e.id}>
                    <TD>
                      <Link href={`/xodimlar/${e.id}`} className="font-medium text-slate-900 hover:text-brand-700">{e.full_name}</Link>
                      <p className="text-xs text-slate-500">{e.position}</p>
                    </TD>
                    <TD className="whitespace-nowrap">{e.phone ?? "—"}</TD>
                    <TD>{e.group_teachers.map((g) => g.kg_groups?.name).filter(Boolean).join(", ") || "—"}</TD>
                    <TD>{formatDate(e.start_date)}</TD>
                    <TD className="whitespace-nowrap">
                      {a ? (
                        <span className="text-sm">
                          {formatTime(a.check_in_at)} – {a.check_out_at ? formatTime(a.check_out_at) : <Badge tone="green">{t("ishda")}</Badge>}
                          {a.late_minutes > 0 && <Badge tone="amber" className="ml-1">{t("kechikdi")}</Badge>}
                        </span>
                      ) : isExpectedOn(e, settings, today) ? <Badge tone="red">{t("kelmagan")}</Badge> : <span className="text-slate-400">{t("dam olish")}</span>}
                    </TD>
                    <TD>
                      {e.profiles ? (
                        <span className="font-mono text-xs">{e.profiles.username}{!e.profiles.is_active && <Badge className="ml-1">{t("bloklangan")}</Badge>}</span>
                      ) : <span className="text-xs text-slate-400">{t("yo'q")}</span>}
                    </TD>
                    <TD><StatusBadge map={EMPLOYMENT_STATUS} value={e.status} /></TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
