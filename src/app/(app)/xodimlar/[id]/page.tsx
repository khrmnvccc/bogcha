import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/queries";
import { EMPLOYMENT_STATUS, ROLE_LABELS, ATTENDANCE_SOURCE, type Role } from "@/lib/labels";
import { currentMonthISO, formatDate, formatDateTime, formatMinutes, formatMonth, formatTime, addMonthsISO } from "@/lib/format";
import { PageHeader, InfoRow, EmptyState } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { LinkButton } from "@/components/ui/button";
import { suggestUsername } from "@/lib/accounts";
import { AccountActions } from "@/components/account-actions";
import { EditEmployee, EmployeeGroupsForm, CreateAccountForm } from "./client";
import { resetPassword, setUserActive } from "../actions";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Xodim") };
}

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { t, f } = await getI18n();
  const user = await requireUser(ADMIN_ROLES);
  const { id } = await params;
  const supabase = await createClient();
  const month = currentMonthISO();

  const [{ data: e }, settings, { data: groups }, { data: att }] = await Promise.all([
    supabase.from("employees").select("*, group_teachers(group_id, kg_groups(name)), profiles(id, username, role, is_active, must_change_password)").eq("id", id).maybeSingle(),
    getSettings(supabase),
    supabase.from("kg_groups").select("id, name").eq("is_active", true).order("name"),
    supabase.from("employee_attendance").select("*").eq("employee_id", id).gte("work_date", month).lt("work_date", addMonthsISO(month, 1)).order("work_date", { ascending: false }),
  ]);
  if (!e) notFound();

  const records = att ?? [];
  const totalMin = records.reduce((s, r) => s + (r.worked_minutes ?? 0), 0);
  const lateCount = records.filter((r) => r.late_minutes > 0).length;
  const missing = records.filter((r) => !r.check_out_at && r.work_date < new Date().toISOString().slice(0, 10)).length;
  const profile = e.profiles as { id: string; username: string; role: Role; is_active: boolean; must_change_password: boolean } | null;
  const selectedGroups = (e.group_teachers as { group_id: string }[]).map((g) => g.group_id);
  const leadershipTarget = profile && ["director", "admin"].includes(profile.role);
  const canManageAccount = profile && profile.id !== user.id && (!leadershipTarget || user.profile.role === "director");

  return (
    <div>
      <PageHeader title={e.full_name} description={e.position} back={{ href: "/xodimlar", label: "Xodimlar" }}
        actions={<LinkButton variant="outline" href={`/ishga-kelish?xodim=${e.id}&dan=${month}`}>{t("Davomat tarixi")}</LinkButton>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t("Ma'lumotlar")} action={<EditEmployee employee={e} defaults={{ start: settings.work_start.slice(0, 5), end: settings.work_end.slice(0, 5), days: settings.work_days }} />} />
            <CardBody>
              <dl className="divide-y divide-slate-100">
                <InfoRow label={t("Telefon")}>{e.phone ?? "—"}</InfoRow>
                <InfoRow label={t("Holati")}><StatusBadge map={EMPLOYMENT_STATUS} value={e.status} /></InfoRow>
                <InfoRow label={t("Ishga kirgan")}>{formatDate(e.start_date)}</InfoRow>
                {e.end_date && <InfoRow label={t("Ishdan ketgan")}>{formatDate(e.end_date)}</InfoRow>}
                <InfoRow label={t("Ish vaqti")}>
                  {(e.schedule_start ?? settings.work_start).slice(0, 5)} – {(e.schedule_end ?? settings.work_end).slice(0, 5)}
                  {!e.schedule_start && !e.schedule_end && <span className="ml-1 text-xs text-slate-400">{t("(umumiy)")}</span>}
                </InfoRow>
                {e.notes && <InfoRow label={t("Izoh")}>{e.notes}</InfoRow>}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("{0} davomati", [f.formatMonth(month)])} description={t("Jami: {0} · Kechikish: {1} · Ketish belgilanmagan: {2}", [f.formatMinutes(totalMin), lateCount, missing])} />
            {records.length === 0 ? <EmptyState title={t("Bu oyda yozuvlar yo'q")} /> : (
              <Table>
                <THead><tr><TH>{t("Sana")}</TH><TH>{t("Keldi")}</TH><TH>{t("Ketdi")}</TH><TH>{t("Ishladi")}</TH><TH>{t("Usul")}</TH><TH>{t("Belgilar")}</TH></tr></THead>
                <tbody>
                  {records.map((r) => (
                    <TR key={r.id}>
                      <TD>{formatDate(r.work_date)}</TD>
                      <TD>{formatTime(r.check_in_at)}</TD>
                      <TD>{r.check_out_at ? formatTime(r.check_out_at) : <Badge tone="amber">{t("belgilanmagan")}</Badge>}</TD>
                      <TD>{f.formatMinutes(r.worked_minutes)}</TD>
                      <TD><Badge tone={ATTENDANCE_SOURCE[r.check_in_source]?.tone} title={t(ATTENDANCE_SOURCE[r.check_in_source]?.hint ?? "")}>{t(ATTENDANCE_SOURCE[r.check_in_source]?.label ?? "")}</Badge></TD>
                      <TD className="space-x-1">
                        {r.late_minutes > 0 && <Badge tone="amber">{r.late_minutes}{" "}{t("daq kechikdi")}</Badge>}
                        {r.early_leave_minutes > 0 && <Badge tone="amber">{r.early_leave_minutes}{" "}{t("daq erta ketdi")}</Badge>}
                        {r.is_corrected && <Badge tone="violet">{t("tuzatilgan")}</Badge>}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("Tizim hisobi")} />
            <CardBody className="space-y-4">
              {profile ? (
                <>
                  <dl className="divide-y divide-slate-100">
                    <InfoRow label={t("Login")}><span className="font-mono">{profile.username}</span></InfoRow>
                    <InfoRow label={t("Roli")}>{t(ROLE_LABELS[profile.role])}</InfoRow>
                    <InfoRow label={t("Holati")}>{profile.is_active ? <Badge tone="green">{t("Faol")}</Badge> : <Badge tone="red">{t("Bloklangan")}</Badge>}</InfoRow>
                    {profile.must_change_password && <InfoRow label={t("Parol")}><Badge tone="amber">{t("Hali almashtirilmagan")}</Badge></InfoRow>}
                  </dl>
                  {canManageAccount && <AccountActions profileId={profile.id} isActive={profile.is_active} resetAction={resetPassword} activeAction={setUserActive} />}
                </>
              ) : (
                <CreateAccountForm employeeId={e.id} suggested={suggestUsername(e.full_name)} canLeadership={user.profile.role === "director"} />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("Biriktirilgan guruhlar")} />
            <CardBody>
              <EmployeeGroupsForm employeeId={e.id} groups={groups ?? []} selected={selectedGroups} />
            </CardBody>
          </Card>
          <p className="px-1 text-xs text-slate-400">{t("Yaratilgan:")}{" "}{formatDateTime(e.created_at)}</p>
        </div>
      </div>
    </div>
  );
}
