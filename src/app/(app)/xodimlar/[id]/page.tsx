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

export const metadata: Metadata = { title: "Xodim" };

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
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
        actions={<LinkButton variant="outline" href={`/ishga-kelish?xodim=${e.id}&dan=${month}`}>Davomat tarixi</LinkButton>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Ma'lumotlar" action={<EditEmployee employee={e} defaults={{ start: settings.work_start.slice(0, 5), end: settings.work_end.slice(0, 5), days: settings.work_days }} />} />
            <CardBody>
              <dl className="divide-y divide-slate-100">
                <InfoRow label="Telefon">{e.phone ?? "—"}</InfoRow>
                <InfoRow label="Holati"><StatusBadge map={EMPLOYMENT_STATUS} value={e.status} /></InfoRow>
                <InfoRow label="Ishga kirgan">{formatDate(e.start_date)}</InfoRow>
                {e.end_date && <InfoRow label="Ishdan ketgan">{formatDate(e.end_date)}</InfoRow>}
                <InfoRow label="Ish vaqti">
                  {(e.schedule_start ?? settings.work_start).slice(0, 5)} – {(e.schedule_end ?? settings.work_end).slice(0, 5)}
                  {!e.schedule_start && !e.schedule_end && <span className="ml-1 text-xs text-slate-400">(umumiy)</span>}
                </InfoRow>
                {e.notes && <InfoRow label="Izoh">{e.notes}</InfoRow>}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={`${formatMonth(month)} davomati`} description={`Jami: ${formatMinutes(totalMin)} · Kechikish: ${lateCount} · Ketish belgilanmagan: ${missing}`} />
            {records.length === 0 ? <EmptyState title="Bu oyda yozuvlar yo'q" /> : (
              <Table>
                <THead><tr><TH>Sana</TH><TH>Keldi</TH><TH>Ketdi</TH><TH>Ishladi</TH><TH>Usul</TH><TH>Belgilar</TH></tr></THead>
                <tbody>
                  {records.map((r) => (
                    <TR key={r.id}>
                      <TD>{formatDate(r.work_date)}</TD>
                      <TD>{formatTime(r.check_in_at)}</TD>
                      <TD>{r.check_out_at ? formatTime(r.check_out_at) : <Badge tone="amber">belgilanmagan</Badge>}</TD>
                      <TD>{formatMinutes(r.worked_minutes)}</TD>
                      <TD><Badge tone={ATTENDANCE_SOURCE[r.check_in_source]?.tone} title={ATTENDANCE_SOURCE[r.check_in_source]?.hint}>{ATTENDANCE_SOURCE[r.check_in_source]?.label}</Badge></TD>
                      <TD className="space-x-1">
                        {r.late_minutes > 0 && <Badge tone="amber">{r.late_minutes} daq kechikdi</Badge>}
                        {r.early_leave_minutes > 0 && <Badge tone="amber">{r.early_leave_minutes} daq erta ketdi</Badge>}
                        {r.is_corrected && <Badge tone="violet">tuzatilgan</Badge>}
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
            <CardHeader title="Tizim hisobi" />
            <CardBody className="space-y-4">
              {profile ? (
                <>
                  <dl className="divide-y divide-slate-100">
                    <InfoRow label="Login"><span className="font-mono">{profile.username}</span></InfoRow>
                    <InfoRow label="Roli">{ROLE_LABELS[profile.role]}</InfoRow>
                    <InfoRow label="Holati">{profile.is_active ? <Badge tone="green">Faol</Badge> : <Badge tone="red">Bloklangan</Badge>}</InfoRow>
                    {profile.must_change_password && <InfoRow label="Parol"><Badge tone="amber">Hali almashtirilmagan</Badge></InfoRow>}
                  </dl>
                  {canManageAccount && <AccountActions profileId={profile.id} isActive={profile.is_active} resetAction={resetPassword} activeAction={setUserActive} />}
                </>
              ) : (
                <CreateAccountForm employeeId={e.id} suggested={suggestUsername(e.full_name)} canLeadership={user.profile.role === "director"} />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Biriktirilgan guruhlar" />
            <CardBody>
              <EmployeeGroupsForm employeeId={e.id} groups={groups ?? []} selected={selectedGroups} />
            </CardBody>
          </Card>
          <p className="px-1 text-xs text-slate-400">Yaratilgan: {formatDateTime(e.created_at)}</p>
        </div>
      </div>
    </div>
  );
}
