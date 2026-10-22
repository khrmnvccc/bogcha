import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser, STAFF_ROLES, ADMIN_ROLES, canViewFinance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CHILD_STATUS } from "@/lib/labels";
import { ageFromBirth, formatDate, formatSom } from "@/lib/format";
import { rangeOf } from "@/lib/queries";
import { safeSearch, sp } from "@/lib/utils";
import { PageHeader, EmptyState, Pagination } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { FilterBar } from "@/components/ui/filter-bar";
import { LinkButton } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Bolalar") };
}
const PAGE = 25;

type Row = {
  id: string; full_name: string; birth_date: string; enrollment_date: string; status: string; monthly_fee: number | null;
  kg_groups: { name: string; monthly_fee: number | null } | null;
  child_guardians: { relationship: string; is_primary: boolean; guardians: { full_name: string; phone: string } | null }[];
};

export default async function ChildrenPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, f } = await getI18n();
  const user = await requireUser(STAFF_ROLES);
  const isAdmin = ADMIN_ROLES.includes(user.profile.role);
  const showFee = canViewFinance(user);
  const params = await searchParams;
  const q = safeSearch(sp(params.q));
  const group = sp(params.guruh);
  const status = sp(params.holat) ?? "active";
  const page = Math.max(1, Number(sp(params.sahifa) ?? 1) || 1);
  const supabase = await createClient();

  let query = supabase.from("children")
    .select("id, full_name, birth_date, enrollment_date, status, monthly_fee, kg_groups(name, monthly_fee), child_guardians(relationship, is_primary, guardians(full_name, phone))", { count: "exact" })
    .order("full_name").range(...rangeOf(page, PAGE));
  if (q) query = query.ilike("full_name", `%${q}%`);
  if (group === "none") query = query.is("group_id", null);
  else if (group) query = query.eq("group_id", group);
  if (status !== "all") query = query.eq("status", status);

  const [{ data, count }, { data: groups }, { data: s }] = await Promise.all([
    query,
    supabase.from("kg_groups").select("id, name").eq("is_active", true).order("name"),
    supabase.from("settings").select("default_monthly_fee").eq("id", 1).single(),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const qs = (p: number) => {
    const u = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => typeof v === "string" && u.set(k, v));
    u.set("sahifa", String(p));
    return `/bolalar?${u.toString()}`;
  };

  return (
    <div>
      <PageHeader title={t("Bolalar")} description={t("Bog'chadagi bolalar ro'yxati")}
        actions={isAdmin && <LinkButton href="/bolalar/yangi"><Plus className="h-4 w-4" />{" "}{t("Yangi bola")}</LinkButton>} />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <FilterBar filters={[
            { type: "search", name: "q", placeholder: "Bola ismi bo'yicha qidirish" },
            { type: "select", name: "guruh", label: "Guruh", options: [...(groups ?? []).map((g) => ({ value: g.id, label: g.name })), ...(isAdmin ? [{ value: "none", label: "Guruhsiz" }] : [])] },
            { type: "select", name: "holat", label: "Holat", options: [{ value: "all", label: "Hammasi" }, ...Object.entries(CHILD_STATUS).filter(([k]) => k !== "active").map(([value, v]) => ({ value, label: v.label }))] },
          ]} />
        </div>
        {rows.length === 0 ? (
          <EmptyState title={t("Bolalar topilmadi")} description={q ? t("Boshqa so'z bilan qidirib ko'ring") : undefined}
            action={isAdmin && !q ? <LinkButton href="/bolalar/yangi">{t("Bola qo'shish")}</LinkButton> : undefined} />
        ) : (
          <>
            <Table>
              <THead><tr><TH>{t("Bola")}</TH><TH>{t("Guruh")}</TH><TH>{t("Ota-ona")}</TH><TH>{t("Qabul qilingan")}</TH>{showFee && <TH className="text-right">{t("Oylik to'lov")}</TH>}<TH>{t("Holat")}</TH></tr></THead>
              <tbody>
                {rows.map((c) => {
                  const primary = c.child_guardians.find((g) => g.is_primary) ?? c.child_guardians[0];
                  return (
                    <TR key={c.id}>
                      <TD>
                        <Link href={`/bolalar/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700">{c.full_name}</Link>
                        <p className="text-xs text-slate-500">{f.ageFromBirth(c.birth_date)} · {formatDate(c.birth_date)}</p>
                      </TD>
                      <TD>{c.kg_groups?.name ?? <span className="text-slate-400">—</span>}</TD>
                      <TD>
                        {primary?.guardians ? <>
                          <p className="text-sm">{primary.guardians.full_name} <span className="text-xs text-slate-400">({primary.relationship})</span></p>
                          <a href={`tel:${primary.guardians.phone}`} className="text-xs text-brand-700">{primary.guardians.phone}</a>
                        </> : <span className="text-slate-400">—</span>}
                      </TD>
                      <TD>{formatDate(c.enrollment_date)}</TD>
                      {showFee && <TD className="whitespace-nowrap text-right">{f.formatSom(c.monthly_fee ?? c.kg_groups?.monthly_fee ?? s?.default_monthly_fee)}</TD>}
                      <TD><StatusBadge map={CHILD_STATUS} value={c.status} /></TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE} total={count ?? 0} makeHref={qs} />
          </>
        )}
      </Card>
    </div>
  );
}
