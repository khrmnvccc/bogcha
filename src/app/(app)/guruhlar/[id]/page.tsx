import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { requireUser, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ATTENDANCE_STATUS } from "@/lib/labels";
import { ageFromBirth, formatDate, todayISO } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { LinkButton } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Guruh") };
}

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, f } = await getI18n();
  await requireUser(STAFF_ROLES);
  const { id } = await params;
  const supabase = await createClient();
  const today = todayISO();
  const { data: g } = await supabase.from("kg_groups")
    .select("id, name, age_range, room, capacity, group_teachers(is_lead, employees(id, full_name, phone, position))")
    .eq("id", id).maybeSingle();
  if (!g) notFound();
  const { data: kids } = await supabase.from("children").select("id, full_name, birth_date, enrollment_date").eq("group_id", id).eq("status", "active").order("full_name");
  const ids = (kids ?? []).map((k) => k.id);
  const { data: att } = ids.length ? await supabase.from("child_attendance").select("child_id, status").eq("date", today).in("child_id", ids) : { data: [] };
  const attMap = new Map((att ?? []).map((a) => [a.child_id as string, a.status as string]));
  type T = { is_lead: boolean; employees: { id: string; full_name: string; phone: string | null; position: string } | null };

  return (
    <div className="space-y-6">
      <PageHeader title={g.name} description={[g.age_range, g.room].filter(Boolean).join(" · ") || undefined} back={{ href: "/guruhlar", label: "Guruhlar" }}
        actions={<LinkButton href={`/davomat?guruh=${g.id}`}><CalendarCheck className="h-4 w-4" />{" "}{t("Bugungi davomat")}</LinkButton>} />
      <Card>
        <CardHeader title={t("Tarbiyachilar")} />
        <ul className="divide-y divide-slate-100">
          {((g.group_teachers ?? []) as unknown as T[]).length === 0 && <li className="px-5 py-4 text-sm text-slate-500">{t("Tarbiyachi biriktirilmagan")}</li>}
          {((g.group_teachers ?? []) as unknown as T[]).map((t) => t.employees && (
            <li key={t.employees.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="font-medium text-slate-900">{t.employees.full_name} <span className="font-normal text-slate-500">· {t.employees.position}</span></span>
              {t.employees.phone && <a href={`tel:${t.employees.phone}`} className="text-brand-700">{t.employees.phone}</a>}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title={t("Bolalar")} description={t("{0}{1} ta faol bola", [kids?.length ?? 0, g.capacity ? ` / ${g.capacity}` : ""])} />
        {(kids ?? []).length === 0 ? <EmptyState title={t("Guruhda bolalar yo'q")} /> : (
          <Table>
            <THead><tr><TH>{t("Bola")}</TH><TH>{t("Yoshi")}</TH><TH>{t("Qabul qilingan")}</TH><TH>{t("Bugun")}</TH></tr></THead>
            <tbody>
              {(kids ?? []).map((k) => (
                <TR key={k.id}>
                  <TD><Link href={`/bolalar/${k.id}`} className="font-medium text-slate-900 hover:text-brand-700">{k.full_name}</Link></TD>
                  <TD>{f.ageFromBirth(k.birth_date)}</TD>
                  <TD>{formatDate(k.enrollment_date)}</TD>
                  <TD>{attMap.has(k.id) ? <StatusBadge map={ATTENDANCE_STATUS} value={attMap.get(k.id)} /> : <Badge>{t("Belgilanmagan")}</Badge>}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
