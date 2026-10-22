import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";
import { requireUser, FINANCE_ROLES, ADMIN_ROLES, hasPermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ADJUSTMENT_KIND, INVOICE_STATUS, PAYMENT_METHOD } from "@/lib/labels";
import { formatDate, formatDateTime, formatMonth, formatSom } from "@/lib/format";
import { PageHeader, InfoRow, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { PaymentDialog } from "../../payment-dialog";
import { AdjustmentDialog, BaseAmountDialog, VoidPayment } from "../../tools";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Hisob") };
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { t, f } = await getI18n();
  const user = await requireUser(FINANCE_ROLES);
  const { id } = await params;
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invoices").select("*, children(id, full_name, kg_groups(name))").eq("id", id).maybeSingle();
  if (!inv) notFound();
  const [{ data: adjustments }, { data: payments }] = await Promise.all([
    supabase.from("invoice_adjustments").select("*, profiles:approved_by(full_name)").eq("invoice_id", id).order("created_at"),
    supabase.from("payments").select("*, recorder:recorded_by(full_name), voider:voided_by(full_name)").eq("invoice_id", id).order("created_at"),
  ]);
  const child = inv.children as { id: string; full_name: string; kg_groups: { name: string } | null };
  const isAdmin = ADMIN_ROLES.includes(user.profile.role);

  return (
    <div className="space-y-6">
      <PageHeader title={`${child.full_name} · ${f.formatMonth(inv.period)}`} description={child.kg_groups?.name ?? undefined}
        back={{ href: `/tolovlar?oy=${inv.period.slice(0, 7)}`, label: "Oylik to'lovlar" }}
        actions={<>
          {inv.balance > 0 && <PaymentDialog kids={[{ id: child.id, full_name: child.full_name }]} preset={{ childId: child.id, month: inv.period }} balance={Number(inv.balance)} />}
          {hasPermission(user, "finance.adjust") && <AdjustmentDialog invoiceId={inv.id} />}
        </>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title={t("Hisob")} action={isAdmin && <BaseAmountDialog invoiceId={inv.id} current={Number(inv.base_amount)} />} />
          <CardBody>
            <dl className="divide-y divide-slate-100">
              <InfoRow label={t("Asosiy summa")}>{f.formatSom(inv.base_amount)}</InfoRow>
              <InfoRow label={t("Chegirma / tuzatish")}>{f.formatSom(inv.adjustments_total, { signed: true })}</InfoRow>
              <InfoRow label={t("To'lanishi kerak")}>{f.formatSom(inv.amount_due)}</InfoRow>
              <InfoRow label={t("To'langan")}><span className="text-mint-700">{f.formatSom(inv.paid_total)}</span></InfoRow>
              <InfoRow label={t("Qoldiq")}><span className="text-base">{f.formatSom(inv.balance)}</span></InfoRow>
              <InfoRow label={t("Holat")}><StatusBadge map={INVOICE_STATUS} value={inv.status} /></InfoRow>
              <InfoRow label={t("To'lov muddati")}>{formatDate(inv.due_date)}</InfoRow>
            </dl>
            <Link href={`/bolalar/${child.id}`} className="mt-4 inline-block text-sm text-brand-700">{t("Bola profili →")}</Link>
          </CardBody>
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t("To'lovlar")} />
            {(payments ?? []).length === 0 ? <EmptyState title={t("Hali to'lov yo'q")} /> : (
              <Table>
                <THead><tr><TH>{t("Sana")}</TH><TH>{t("Kvitansiya")}</TH><TH>{t("Usul")}</TH><TH className="text-right">{t("Summa")}</TH><TH>{t("Kiritgan")}</TH><TH /></tr></THead>
                <tbody>
                  {(payments ?? []).map((p) => (
                    <TR key={p.id} className={p.is_void ? "opacity-60" : undefined}>
                      <TD>{formatDate(p.paid_on)}</TD>
                      <TD className="font-mono text-xs">{p.receipt_number}{p.is_void && <Badge tone="red" className="ml-1">{t("bekor qilingan")}</Badge>}
                        {p.is_void && <p className="mt-1 font-sans text-xs text-slate-500">{p.void_reason} · {(p.voider as { full_name: string } | null)?.full_name} · {formatDateTime(p.voided_at)}</p>}
                        {p.note && <p className="mt-1 font-sans text-xs text-slate-500">{p.note}</p>}
                      </TD>
                      <TD>{t(PAYMENT_METHOD[p.method])}</TD>
                      <TD className={`text-right font-medium ${p.is_void ? "line-through" : ""}`}>{f.formatSom(p.amount)}</TD>
                      <TD className="text-xs text-slate-500">{(p.recorder as { full_name: string } | null)?.full_name}<br />{formatDateTime(p.created_at)}</TD>
                      <TD className="whitespace-nowrap text-right">
                        {!p.is_void && <a href={`/api/kvitansiya/${p.id}`} target="_blank" rel="noopener" className="inline-flex p-2 text-brand-700" aria-label={t("Kvitansiya")}><FileDown className="h-4 w-4" /></a>}
                        {!p.is_void && <VoidPayment id={p.id} receipt={p.receipt_number} />}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          <Card>
            <CardHeader title={t("Chegirma va tuzatishlar")} />
            {(adjustments ?? []).length === 0 ? <EmptyState title={t("Yo'q")} /> : (
              <ul className="divide-y divide-slate-100">
                {(adjustments ?? []).map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{t(ADJUSTMENT_KIND[a.kind])}: {a.reason}</p>
                      <p className="text-xs text-slate-500">{t("Tasdiqladi:")}{" "}{(a.profiles as { full_name: string } | null)?.full_name} · {formatDateTime(a.created_at)}</p>
                    </div>
                    <span className="whitespace-nowrap font-semibold">{f.formatSom(a.amount, { signed: true })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
