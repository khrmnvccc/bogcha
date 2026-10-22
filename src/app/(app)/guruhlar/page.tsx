import type { Metadata } from "next";
import Link from "next/link";
import { Users, DoorOpen, Wallet, Archive, RotateCcw } from "lucide-react";
import { requireUser, STAFF_ROLES, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/queries";
import { formatSom } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/dialog";
import { GroupForm } from "./group-form";
import { setGroupActive } from "./actions";
import { sp } from "@/lib/utils";

export const metadata: Metadata = { title: "Guruhlar" };

type G = {
  id: string; name: string; age_range: string | null; room: string | null; capacity: number | null; monthly_fee: number | null;
  academic_period_id: string | null; is_active: boolean;
  children: { status: string }[];
  group_teachers: { employee_id: string; employees: { full_name: string } | null }[];
};

export default async function GroupsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(STAFF_ROLES);
  const isAdmin = ADMIN_ROLES.includes(user.profile.role);
  const showArchived = sp((await searchParams).arxiv) === "1";
  const supabase = await createClient();

  let q = supabase.from("kg_groups")
    .select("id, name, age_range, room, capacity, monthly_fee, academic_period_id, is_active, children(status), group_teachers(employee_id, employees(full_name))")
    .eq("is_active", !showArchived).order("name");
  if (user.profile.role === "teacher") {
    const { data: mine } = await supabase.from("group_teachers").select("group_id").eq("employee_id", user.employeeId ?? "00000000-0000-0000-0000-000000000000");
    q = q.in("id", (mine ?? []).map((m) => m.group_id));
  }
  const [{ data }, settings, { data: teachers }, { data: periods }] = await Promise.all([
    q,
    getSettings(supabase),
    isAdmin ? supabase.from("employees").select("id, full_name, position").eq("status", "active").order("full_name") : Promise.resolve({ data: [] }),
    isAdmin ? supabase.from("academic_periods").select("id, name").order("start_date", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const groups = (data ?? []) as unknown as G[];

  return (
    <div>
      <PageHeader
        title={user.profile.role === "teacher" ? "Guruhlarim" : "Guruhlar"}
        description={showArchived ? "Arxivlangan guruhlar" : "Guruhlar, xonalar va biriktirilgan tarbiyachilar"}
        actions={isAdmin && <>
          <Link href={showArchived ? "/guruhlar" : "/guruhlar?arxiv=1"} className="text-sm text-slate-500 hover:text-brand-700">{showArchived ? "Faol guruhlar" : "Arxiv"}</Link>
          <GroupForm teachers={teachers ?? []} periods={periods ?? []} defaultFee={formatSom(settings.default_monthly_fee)} />
        </>}
      />
      {groups.length === 0 ? (
        <Card><EmptyState title={showArchived ? "Arxivda guruh yo'q" : "Guruhlar yo'q"} description={isAdmin ? "Yangi guruh yarating" : "Sizga hali guruh biriktirilmagan"} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => {
            const active = g.children.filter((c) => c.status === "active").length;
            const full = g.capacity != null && active >= g.capacity;
            return (
              <Card key={g.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3 p-5 pb-3">
                  <div className="min-w-0">
                    <Link href={`/guruhlar/${g.id}`} className="text-lg font-semibold text-slate-900 hover:text-brand-700">{g.name}</Link>
                    {g.age_range && <p className="text-sm text-slate-500">{g.age_range}</p>}
                  </div>
                  <Badge tone={full ? "amber" : "blue"}>{active}{g.capacity ? ` / ${g.capacity}` : ""} bola</Badge>
                </div>
                <div className="flex-1 space-y-2 px-5 pb-4 text-sm text-slate-600">
                  <p className="flex items-center gap-2"><DoorOpen className="h-4 w-4 text-slate-400" /> {g.room ?? "Xona ko'rsatilmagan"}</p>
                  <p className="flex items-center gap-2"><Users className="h-4 w-4 text-slate-400" /> {g.group_teachers.map((t) => t.employees?.full_name).filter(Boolean).join(", ") || "Tarbiyachi biriktirilmagan"}</p>
                  {user.profile.role !== "teacher" && (
                    <p className="flex items-center gap-2"><Wallet className="h-4 w-4 text-slate-400" /> {formatSom(g.monthly_fee ?? settings.default_monthly_fee)}{g.monthly_fee == null && <span className="text-xs text-slate-400">(umumiy)</span>}</p>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex justify-end gap-1 border-t border-slate-100 px-3 py-2">
                    <GroupForm teachers={teachers ?? []} periods={periods ?? []} defaultFee={formatSom(settings.default_monthly_fee)}
                      group={{ ...g, teacher_ids: g.group_teachers.map((t) => t.employee_id) }} />
                    <ConfirmAction
                      trigger={<Button variant="ghost" size="sm">{g.is_active ? <><Archive className="h-4 w-4" /> Arxivlash</> : <><RotateCcw className="h-4 w-4" /> Tiklash</>}</Button>}
                      title={g.is_active ? "Guruhni arxivlaysizmi?" : "Guruhni tiklaysizmi?"}
                      description={g.is_active ? "Arxivlangan guruh ro'yxatlarda ko'rinmaydi. Tarix saqlanib qoladi." : "Guruh yana faol bo'ladi."}
                      action={setGroupActive} hidden={{ id: g.id, active: String(!g.is_active) }} danger={g.is_active}
                      confirmText={g.is_active ? "Arxivlash" : "Tiklash"}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
