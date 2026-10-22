import type { Metadata } from "next";
import Link from "next/link";
import { Wallet, CheckCircle2, AlertCircle, Percent, FileSpreadsheet, FileText } from "lucide-react";
import { requireUser, FINANCE_ROLES, hasPermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { INVOICE_STATUS } from "@/lib/labels";
import { currentMonthISO, formatDate, formatMonth, formatSom, todayISO } from "@/lib/format";
import { safeSearch, sp } from "@/lib/utils";
import { PageHeader, StatCard, EmptyState, Notice } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { FilterBar } from "@/components/ui/filter-bar";
import { LinkButton } from "@/components/ui/button";
import { PaymentDialog } from "./payment-dialog";
import { GenerateInvoices, AdjustmentDialog, DebtReminders } from "./tools";
import { anyChannelConfigured } from "@/lib/integrations/dispatch";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Oylik to'lovlar") };
}

type Inv = {
  id: string; child_id: string; period: string; amount_due: number; paid_total: number; balance: number; status: string; due_date: string;
  adjustments_total: number; children: { full_name: string; group_id: string | null; kg_groups: { name: string } | null } | null;
};

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, f } = await getI18n();
  const user = await requireUser(FINANCE_ROLES);
  const params = await searchParams;
  const supabase = await createClient();
  const today = todayISO();
  const monthParam = sp(params.oy);
  const childId = sp(params.bola);
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? `${monthParam}-01` : currentMonthISO();
  const status = sp(params.holat);
  const group = sp(params.guruh);
  const q = safeSearch(sp(params.q));

  let query = supabase.from("invoices")
    .select("id, child_id, period, amount_due, paid_total, balance, status, due_date, adjustments_total, children!inner(full_name, group_id, kg_groups(name))")
    .order("period", { ascending: false });
  if (childId) query = query.eq("child_id", childId);
  else if (status === "qarz") query = query.gt("balance", 0).lte("period", currentMonthISO());
  else query = query.eq("period", month);
  if (status && status !== "qarz") query = query.eq("status", status);
  if (group) query = query.eq("children.group_id", group);
  if (q) query = query.ilike("children.full_name", `%${q}%`);

  const [{ data }, { data: groups }, { data: kids }] = await Promise.all([
    query.limit(1000),
    supabase.from("kg_groups").select("id, name").eq("is_active", true).order("name"),
    supabase.from("children").select("id, full_name, kg_groups(name)").in("status", ["active", "paused"]).order("full_name"),
  ]);
  const rows = ((data ?? []) as unknown as Inv[]).sort((a, b) => (a.children?.full_name ?? "").localeCompare(b.children?.full_name ?? "") || b.period.localeCompare(a.period));
  const expected = rows.reduce((s, r) => s + Number(r.amount_due), 0);
  const collected = rows.reduce((s, r) => s + Math.min(Number(r.paid_total), Number(r.amount_due)), 0);
  const outstanding = rows.reduce((s, r) => s + Math.max(0, Number(r.balance)), 0);
  const rate = expected > 0 ? Math.round((collected / expected) * 100) : null;
  const kidOptions = ((kids ?? []) as unknown as { id: string; full_name: string; kg_groups: { name: string } | null }[]).map((k) => ({ id: k.id, full_name: k.full_name, group: k.kg_groups?.name }));
  const canAdjust = hasPermission(user, "finance.adjust");
  const childName = childId ? kidOptions.find((k) => k.id === childId)?.full_name : null;
  const exportQs = `oy=${month.slice(0, 7)}${group ? `&guruh=${group}` : ""}${status ? `&holat=${status}` : ""}`;

  return (
    <div>
      <PageHeader
        title={t("Oylik to'lovlar")}
        description={childName ? t("{0} hisoblari", [childName]) : status === "qarz" ? t("Barcha qarzdorliklar") : t("{0} hisoblari", [f.formatMonth(month)])}
        actions={<>
          {!childId && status !== "qarz" && <GenerateInvoices month={month.slice(0, 7)} />}
          {!childId && <DebtReminders enabled={anyChannelConfigured()} />}
          <PaymentDialog kids={kidOptions} preset={childId ? { childId, month: currentMonthISO() } : undefined} />
        </>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("Hisoblangan")} value={f.formatSom(expected)} icon={<Wallet className="h-5 w-5" />} />
        <StatCard label={t("Yig'ilgan")} value={f.formatSom(collected)} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <StatCard label={t("Qarzdorlik")} value={f.formatSom(outstanding)} icon={<AlertCircle className="h-5 w-5" />} tone="red" />
        <StatCard label={t("Yig'ish darajasi")} value={rate == null ? "—" : `${rate}%`} icon={<Percent className="h-5 w-5" />} tone="amber" />
      </div>
      <Notice tone="blue" className="mb-4">{t("To'lovlar qo'lda qayd etiladi (naqd yoki bank o'tkazmasi). Tizim onlayn to'lovni qabul qilmaydi va tasdiqlamaydi.")}</Notice>
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          {childId ? (
            <Link href="/tolovlar" className="text-sm text-brand-700">{t("← Barcha bolalar")}</Link>
          ) : (
            <FilterBar filters={[
              { type: "month", name: "oy", label: "Oy" },
              { type: "search", name: "q", placeholder: "Bola ismi" },
              { type: "select", name: "guruh", label: "Guruh", options: (groups ?? []).map((g) => ({ value: g.id, label: g.name })) },
              { type: "select", name: "holat", label: "Holat", options: [...Object.entries(INVOICE_STATUS).map(([value, v]) => ({ value, label: v.label })), { value: "qarz", label: "Barcha qarzdorlar" }] },
            ]} />
          )}
          {!childId && (
            <div className="flex gap-2">
              <LinkButton variant="outline" size="sm" href={`/api/hisobot/tolovlar?${exportQs}&format=xlsx`} prefetch={false}><FileSpreadsheet className="h-4 w-4" />{" "}{t("Excel")}</LinkButton>
              <LinkButton variant="outline" size="sm" href={`/api/hisobot/tolovlar?${exportQs}&format=pdf`} prefetch={false}><FileText className="h-4 w-4" />{" "}{t("PDF")}</LinkButton>
            </div>
          )}
        </div>
        {rows.length === 0 ? (
          <EmptyState title={t("Hisoblar topilmadi")} description={!childId && status !== "qarz" ? t("Bu oy uchun hali hisoblar yaratilmagan bo'lishi mumkin. \"Hisoblarni yaratish\" tugmasini bosing.") : undefined} />
        ) : (
          <Table>
            <THead>
              <tr><TH>{t("Bola")}</TH>{(childId || status === "qarz") && <TH>{t("Oy")}</TH>}<TH className="text-right">{t("Hisoblangan")}</TH><TH className="text-right">{t("To'langan")}</TH><TH className="text-right">{t("Qoldiq")}</TH><TH>{t("Holat")}</TH><TH>{t("Muddat")}</TH><TH className="text-right">{t("Amallar")}</TH></tr>
            </THead>
            <tbody>
              {rows.map((r) => {
                const overdue = r.balance > 0 && r.due_date < today;
                return (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/tolovlar/hisob/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">{r.children?.full_name}</Link>
                      <p className="text-xs text-slate-500">{r.children?.kg_groups?.name ?? t("Guruhsiz")}</p>
                    </TD>
                    {(childId || status === "qarz") && <TD className="whitespace-nowrap">{f.formatMonth(r.period)}</TD>}
                    <TD className="whitespace-nowrap text-right">
                      {f.formatSom(r.amount_due)}
                      {Number(r.adjustments_total) !== 0 && <p className="text-xs text-slate-400">{t("tuzatish:")}{" "}{f.formatSom(r.adjustments_total, { signed: true })}</p>}
                    </TD>
                    <TD className="whitespace-nowrap text-right text-mint-700">{f.formatSom(r.paid_total)}</TD>
                    <TD className="whitespace-nowrap text-right font-semibold">
                      {r.balance < 0 ? <span className="text-brand-700" title={t("Ortiqcha to'langan")}>{f.formatSom(-r.balance)}{" "}{t("ortiqcha")}</span> : f.formatSom(r.balance)}
                    </TD>
                    <TD><StatusBadge map={INVOICE_STATUS} value={r.status} /></TD>
                    <TD className="whitespace-nowrap">{formatDate(r.due_date)}{overdue && <Badge tone="red" className="ml-1">{t("muddati o'tgan")}</Badge>}</TD>
                    <TD className="whitespace-nowrap text-right">
                      <div className="flex justify-end gap-1">
                        {r.balance > 0 && <PaymentDialog compact kids={kidOptions} preset={{ childId: r.child_id, month: r.period }} balance={Number(r.balance)} />}
                        {canAdjust && <AdjustmentDialog invoiceId={r.id} />}
                      </div>
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
