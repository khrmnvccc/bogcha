import type { Metadata } from "next";
import Link from "next/link";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { requireUser, FINANCE_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_METHOD } from "@/lib/labels";
import { currentMonthISO, formatDate, formatDateTime, formatMonth, formatSom, todayISO } from "@/lib/format";
import { rangeOf } from "@/lib/queries";
import { safeSearch, sp } from "@/lib/utils";
import { PageHeader, EmptyState, Pagination } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { FilterBar } from "@/components/ui/filter-bar";
import { LinkButton } from "@/components/ui/button";
import { VoidPayment } from "../tolovlar/tools";

export const metadata: Metadata = { title: "To'lovlar tarixi" };
const PAGE = 50;

type P = {
  id: string; amount: number; method: string; paid_on: string; receipt_number: string; note: string | null; is_void: boolean; void_reason: string | null;
  created_at: string; invoice_id: string; children: { full_name: string; group_id: string | null } | null; invoices: { period: string } | null; recorder: { full_name: string } | null;
};

export default async function PaymentsHistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(FINANCE_ROLES);
  const params = await searchParams;
  const supabase = await createClient();
  const from = sp(params.dan) ?? currentMonthISO();
  const to = sp(params.gacha) ?? todayISO();
  const method = sp(params.usul);
  const group = sp(params.guruh);
  const showVoid = sp(params.bekor) === "1";
  const q = safeSearch(sp(params.q));
  const page = Math.max(1, Number(sp(params.sahifa) ?? 1) || 1);

  let query = supabase.from("payments")
    .select("id, amount, method, paid_on, receipt_number, note, is_void, void_reason, created_at, invoice_id, children!inner(full_name, group_id), invoices(period), recorder:recorded_by(full_name)", { count: "exact" })
    .gte("paid_on", from).lte("paid_on", to)
    .order("paid_on", { ascending: false }).order("created_at", { ascending: false });
  if (!showVoid) query = query.eq("is_void", false);
  if (method) query = query.eq("method", method);
  if (group) query = query.eq("children.group_id", group);
  if (q) query = query.ilike("children.full_name", `%${q}%`);

  let totalsQ = supabase.from("payments").select("amount, method, children!inner(group_id, full_name)").gte("paid_on", from).lte("paid_on", to).eq("is_void", false);
  if (method) totalsQ = totalsQ.eq("method", method);
  if (group) totalsQ = totalsQ.eq("children.group_id", group);
  if (q) totalsQ = totalsQ.ilike("children.full_name", `%${q}%`);

  const [{ data, count }, { data: totals }, { data: groups }] = await Promise.all([
    query.range(...rangeOf(page, PAGE)),
    totalsQ,
    supabase.from("kg_groups").select("id, name").eq("is_active", true).order("name"),
  ]);
  const rows = (data ?? []) as unknown as P[];
  const sum = (totals ?? []).reduce((s, t) => s + Number(t.amount), 0);
  const byMethod = Object.keys(PAYMENT_METHOD).map((m) => [m, (totals ?? []).filter((t) => t.method === m).reduce((s, t) => s + Number(t.amount), 0)] as const).filter(([, v]) => v > 0);
  const qsBase = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => typeof v === "string" && k !== "sahifa" && qsBase.set(k, v));
  const exportQs = `dan=${from}&gacha=${to}${method ? `&usul=${method}` : ""}${group ? `&guruh=${group}` : ""}`;

  return (
    <div>
      <PageHeader title="To'lovlar tarixi" description={`${formatDate(from)} – ${formatDate(to)} · Jami: ${formatSom(sum)}`}
        actions={<>
          <LinkButton variant="outline" size="sm" href={`/api/hisobot/tolovlar-tarixi?${exportQs}&format=xlsx`} prefetch={false}><FileSpreadsheet className="h-4 w-4" /> Excel</LinkButton>
          <LinkButton variant="outline" size="sm" href={`/api/hisobot/tolovlar-tarixi?${exportQs}&format=pdf`} prefetch={false}><FileText className="h-4 w-4" /> PDF</LinkButton>
        </>} />
      {byMethod.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {byMethod.map(([m, v]) => <span key={m} className="rounded-full border border-slate-200 bg-white px-3 py-1">{PAYMENT_METHOD[m]}: <b>{formatSom(v)}</b></span>)}
        </div>
      )}
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
          <FilterBar filters={[
            { type: "date", name: "dan", label: "Dan" },
            { type: "date", name: "gacha", label: "Gacha" },
            { type: "search", name: "q", placeholder: "Bola ismi" },
            { type: "select", name: "usul", label: "Usul", options: Object.entries(PAYMENT_METHOD).map(([value, label]) => ({ value, label })) },
            { type: "select", name: "guruh", label: "Guruh", options: (groups ?? []).map((g) => ({ value: g.id, label: g.name })) },
          ]} />
          <Link href={`/tolovlar-tarixi?${(() => { const u = new URLSearchParams(qsBase); if (showVoid) u.delete("bekor"); else u.set("bekor", "1"); return u.toString(); })()}`} className="text-sm text-slate-500 hover:text-brand-700">
            {showVoid ? "Bekor qilinganlarni yashirish" : "Bekor qilinganlarni ham ko'rsatish"}
          </Link>
        </div>
        {rows.length === 0 ? <EmptyState title="Bu davrda to'lovlar yo'q" /> : (
          <>
            <Table>
              <THead><tr><TH>Sana</TH><TH>Bola</TH><TH>Oy</TH><TH>Usul</TH><TH>Kvitansiya</TH><TH className="text-right">Summa</TH><TH>Kiritgan</TH><TH /></tr></THead>
              <tbody>
                {rows.map((p) => (
                  <TR key={p.id} className={p.is_void ? "opacity-60" : undefined}>
                    <TD className="whitespace-nowrap">{formatDate(p.paid_on)}</TD>
                    <TD><Link href={`/tolovlar/hisob/${p.invoice_id}`} className="font-medium hover:text-brand-700">{p.children?.full_name}</Link>{p.note && <p className="text-xs text-slate-500">{p.note}</p>}</TD>
                    <TD className="whitespace-nowrap">{formatMonth(p.invoices?.period)}</TD>
                    <TD>{PAYMENT_METHOD[p.method]}</TD>
                    <TD className="font-mono text-xs">{p.receipt_number}{p.is_void && <Badge tone="red" className="ml-1" title={p.void_reason ?? ""}>bekor</Badge>}</TD>
                    <TD className={`whitespace-nowrap text-right font-semibold ${p.is_void ? "line-through" : "text-mint-700"}`}>{formatSom(p.amount)}</TD>
                    <TD className="text-xs text-slate-500">{p.recorder?.full_name}<br />{formatDateTime(p.created_at)}</TD>
                    <TD className="whitespace-nowrap text-right">
                      {!p.is_void && <a href={`/api/kvitansiya/${p.id}`} target="_blank" rel="noopener" className="inline-flex p-2 text-brand-700" aria-label="Kvitansiya"><FileDown className="h-4 w-4" /></a>}
                      {!p.is_void && <VoidPayment id={p.id} receipt={p.receipt_number} />}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE} total={count ?? 0} makeHref={(n) => { const u = new URLSearchParams(qsBase); u.set("sahifa", String(n)); return `/tolovlar-tarixi?${u.toString()}`; }} />
          </>
        )}
      </Card>
    </div>
  );
}
