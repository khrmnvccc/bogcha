import type { Metadata } from "next";
import Link from "next/link";
import { requireUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PERMISSION_LABELS, ROLE_LABELS, type Role } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { safeSearch, sp } from "@/lib/utils";
import { PageHeader, EmptyState, Notice } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { FilterBar } from "@/components/ui/filter-bar";
import { AccountActions } from "@/components/account-actions";
import { resetPassword, setUserActive } from "../xodimlar/actions";
import { AccessDialog } from "./access-dialog";

export const metadata: Metadata = { title: "Foydalanuvchilar" };

type U = {
  id: string; full_name: string; username: string | null; role: Role; permissions: string[]; is_active: boolean; must_change_password: boolean; created_at: string;
  employees: { id: string }[] | { id: string } | null; guardians: { id: string; child_guardians: { child_id: string }[] }[] | { id: string; child_guardians: { child_id: string }[] } | null;
};
const one = <T,>(v: T[] | T | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(ADMIN_ROLES);
  const params = await searchParams;
  const q = safeSearch(sp(params.q));
  const role = sp(params.rol);
  const st = sp(params.holat);
  const supabase = await createClient();
  let query = supabase.from("profiles").select("id, full_name, username, role, permissions, is_active, must_change_password, created_at, employees(id), guardians(id, child_guardians(child_id))").order("full_name");
  if (q) query = query.or(`full_name.ilike.%${q}%,username.ilike.%${q}%`);
  if (role) query = query.eq("role", role);
  if (st === "faol") query = query.eq("is_active", true);
  if (st === "bloklangan") query = query.eq("is_active", false);
  const { data } = await query.limit(500);
  const rows = (data ?? []) as unknown as U[];
  const isDirector = user.profile.role === "director";

  return (
    <div>
      <PageHeader title="Foydalanuvchilar" description="Tizimga kirish hisoblari, rollar va ruxsatlar" />
      <Notice tone="blue" className="mb-4">
        Xodim hisobi <Link href="/xodimlar" className="font-medium underline">Xodimlar</Link> bo&apos;limida, ota-ona hisobi esa{" "}
        <Link href="/bolalar" className="font-medium underline">bola profilida</Link> yaratiladi. Shunda har bir hisob aniq xodim yoki oilaga bog&apos;lanadi.
      </Notice>
      <Card>
        <div className="border-b border-slate-100 p-4">
          <FilterBar filters={[
            { type: "search", name: "q", placeholder: "Ism yoki login" },
            { type: "select", name: "rol", label: "Rol", options: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })) },
            { type: "select", name: "holat", label: "Holat", options: [{ value: "faol", label: "Faol" }, { value: "bloklangan", label: "Bloklangan" }] },
          ]} />
        </div>
        {rows.length === 0 ? <EmptyState title="Foydalanuvchilar topilmadi" /> : (
          <Table>
            <THead><tr><TH>Foydalanuvchi</TH><TH>Rol</TH><TH>Bog&apos;langan</TH><TH>Holat</TH><TH>Yaratilgan</TH><TH className="text-right">Amallar</TH></tr></THead>
            <tbody>
              {rows.map((u) => {
                const emp = one(u.employees);
                const g = one(u.guardians);
                const leadership = ["director", "admin"].includes(u.role);
                const manageable = u.id !== user.id && (!leadership || isDirector);
                return (
                  <TR key={u.id}>
                    <TD>
                      <p className="font-medium text-slate-900">{u.full_name || "—"}</p>
                      <p className="font-mono text-xs text-slate-500">{u.username}</p>
                    </TD>
                    <TD>
                      <Badge tone={leadership ? "violet" : u.role === "parent" ? "gray" : "blue"}>{ROLE_LABELS[u.role]}</Badge>
                      {u.permissions.length > 0 && <p className="mt-1 text-xs text-slate-500">{u.permissions.map((p) => PERMISSION_LABELS[p]?.label).join("; ")}</p>}
                    </TD>
                    <TD className="text-sm">
                      {emp ? <Link href={`/xodimlar/${emp.id}`} className="text-brand-700">Xodim kartasi</Link>
                        : g ? (g.child_guardians[0] ? <Link href={`/bolalar/${g.child_guardians[0].child_id}`} className="text-brand-700">{g.child_guardians.length} ta bola</Link> : <span className="text-slate-400">Bola bog&apos;lanmagan</span>)
                        : <span className="text-slate-400">—</span>}
                    </TD>
                    <TD>
                      {u.is_active ? <Badge tone="green">Faol</Badge> : <Badge tone="red">Bloklangan</Badge>}
                      {u.must_change_password && <Badge tone="amber" className="ml-1">Vaqtinchalik parol</Badge>}
                    </TD>
                    <TD>{formatDate(u.created_at)}</TD>
                    <TD className="text-right">
                      {manageable ? (
                        <div className="flex flex-wrap justify-end gap-1">
                          <AccessDialog profileId={u.id} role={u.role} permissions={u.permissions} canLeadership={isDirector} />
                          <AccountActions profileId={u.id} isActive={u.is_active} resetAction={resetPassword} activeAction={setUserActive} />
                        </div>
                      ) : <span className="text-xs text-slate-400">{u.id === user.id ? "Siz" : "—"}</span>}
                    </TD>
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
