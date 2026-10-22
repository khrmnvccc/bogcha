import type { Metadata } from "next";
import { FileDown, Info } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyChildren } from "@/lib/parent";
import { ADJUSTMENT_KIND, INVOICE_STATUS, PAYMENT_METHOD } from "@/lib/labels";
import { currentMonthISO, formatDate, formatMonth, formatSom } from "@/lib/format";
import { sp } from "@/lib/utils";
import { PageHeader, EmptyState, StatCard, Notice } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { ChildSwitcher } from "@/components/child-switcher";
import { Wallet, CheckCircle2, AlertCircle } from "lucide-react";

export const metadata: Metadata = { title: "To'lovlar" };

export default async function ParentPayments({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(["parent"]);
  const params = await searchParams;
  const supabase = await createClient();
  const kids = await getMyChildren(supabase, user.guardianId);
  if (!kids.length) return <div><PageHeader title="To'lovlar" /><Card><EmptyState title="Bog'langan bola yo'q" /></Card></div>;
  const child = kids.find((k) => k.id === sp(params.bola)) ?? kids[0];
  const month = currentMonthISO();

  const [{ data: invoices }, { data: payments }, { data: adjustments }] = await Promise.all([
    supabase.from("invoices").select("id, period, base_amount, amount_due, paid_total, balance, status, due_date").eq("child_id", child.id).order("period", { ascending: false }),
    supabase.from("payments").select("id, amount, method, paid_on, receipt_number, is_void, void_reason, invoices(period)").eq("child_id", child.id).order("paid_on", { ascending: false }),
    supabase.from("invoice_adjustments").select("invoice_id, kind, amount, reason, created_at, invoices!inner(period, child_id)").eq("invoices.child_id", child.id).order("created_at", { ascending: false }),
  ]);
  const cur = (invoices ?? []).find((i) => i.period === month);
  const totalPaid = (payments ?? []).filter((p) => !p.is_void).reduce((s, p) => s + Number(p.amount), 0);
  const debt = (invoices ?? []).filter((i) => i.period <= month).reduce((s, i) => s + Math.max(0, Number(i.balance)), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="To'lovlar" description={child.full_name} />
      <ChildSwitcher kids={kids} active={child.id} base="/ota-ona/tolovlar" />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={`${formatMonth(month)} oylik to'lovi`} value={cur ? formatSom(cur.amount_due) : "—"} icon={<Wallet className="h-5 w-5" />}
          hint={cur ? <StatusBadge map={INVOICE_STATUS} value={cur.status} /> : "Hisob hali yaratilmagan"} />
        <StatCard label="Jami to'langan" value={formatSom(totalPaid)} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <StatCard label="Qolgan qarz" value={formatSom(debt)} icon={<AlertCircle className="h-5 w-5" />} tone={debt > 0 ? "red" : "green"} hint={debt > 0 ? "Barcha oylar bo'yicha" : "Qarz yo'q"} />
      </div>
      <Notice tone="blue" className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>To&apos;lovlar bog&apos;cha kassasida naqd yoki bank o&apos;tkazmasi orqali qabul qilinadi va xodim tomonidan qayd etiladi. Tizim orqali onlayn to&apos;lov hozircha mavjud emas.</span>
      </Notice>
      <Card>
        <CardHeader title="Oylar bo'yicha holat" />
        {(invoices ?? []).length === 0 ? <EmptyState title="Hisoblar yo'q" /> : (
          <Table>
            <THead><tr><TH>Oy</TH><TH className="text-right">Oylik</TH><TH className="text-right">To&apos;langan</TH><TH className="text-right">Qoldiq</TH><TH>Holat</TH><TH>Muddat</TH></tr></THead>
            <tbody>
              {(invoices ?? []).map((i) => (
                <TR key={i.id}>
                  <TD className="font-medium">{formatMonth(i.period)}{i.period > month && <Badge tone="blue" className="ml-1">avans</Badge>}</TD>
                  <TD className="text-right">{formatSom(i.amount_due)}{Number(i.amount_due) !== Number(i.base_amount) && <p className="text-xs text-slate-400">asosiy: {formatSom(i.base_amount)}</p>}</TD>
                  <TD className="text-right text-mint-700">{formatSom(i.paid_total)}</TD>
                  <TD className="text-right font-semibold">{formatSom(Math.max(0, i.balance))}</TD>
                  <TD><StatusBadge map={INVOICE_STATUS} value={i.status} /></TD>
                  <TD>{formatDate(i.due_date)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {(adjustments ?? []).length > 0 && (
        <Card>
          <CardHeader title="Chegirma va tuzatishlar" />
          <ul className="divide-y divide-slate-100">
            {((adjustments ?? []) as unknown as { kind: string; amount: number; reason: string; created_at: string; invoices: { period: string } }[]).map((a, i) => (
              <li key={i} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                <span><b>{formatMonth(a.invoices.period)}</b> · {ADJUSTMENT_KIND[a.kind]}: {a.reason}</span>
                <span className="whitespace-nowrap font-semibold">{formatSom(a.amount, { signed: true })}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <CardHeader title="To'lovlar tarixi" />
        {(payments ?? []).length === 0 ? <EmptyState title="Hali to'lovlar yo'q" /> : (
          <Table>
            <THead><tr><TH>Sana</TH><TH>Oy</TH><TH>Usul</TH><TH>Kvitansiya</TH><TH className="text-right">Summa</TH><TH /></tr></THead>
            <tbody>
              {((payments ?? []) as unknown as { id: string; amount: number; method: string; paid_on: string; receipt_number: string; is_void: boolean; void_reason: string | null; invoices: { period: string } | null }[]).map((p) => (
                <TR key={p.id} className={p.is_void ? "opacity-60" : undefined}>
                  <TD>{formatDate(p.paid_on)}</TD>
                  <TD>{formatMonth(p.invoices?.period)}</TD>
                  <TD>{PAYMENT_METHOD[p.method]}</TD>
                  <TD className="font-mono text-xs">{p.receipt_number}{p.is_void && <Badge tone="red" className="ml-1" title={p.void_reason ?? ""}>bekor qilingan</Badge>}</TD>
                  <TD className={`text-right font-semibold ${p.is_void ? "line-through" : ""}`}>{formatSom(p.amount)}</TD>
                  <TD className="text-right">{!p.is_void && <a href={`/api/kvitansiya/${p.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-brand-700"><FileDown className="h-4 w-4" /> Kvitansiya</a>}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
