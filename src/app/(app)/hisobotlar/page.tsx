import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, FileText, FileBarChart } from "lucide-react";
import { requireUser, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { REPORTS, buildReport, canRunReport, type ReportKey } from "@/lib/reports";
import { currentMonthISO, formatNumber, todayISO } from "@/lib/format";
import { cn, sp } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { FilterBar } from "@/components/ui/filter-bar";
import { LinkButton } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Hisobotlar") };
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getI18n();
  const user = await requireUser(STAFF_ROLES);
  const params = await searchParams;
  const available = (Object.keys(REPORTS) as ReportKey[]).filter((k) => canRunReport(user, k));
  if (!available.length) redirect("/");
  const key = (sp(params.tur) as ReportKey) ?? available[0];
  const active = available.includes(key) ? key : available[0];
  const flat: Record<string, string | undefined> = {};
  Object.entries(params).forEach(([k, v]) => (flat[k] = sp(v)));
  if (!flat.oy) flat.oy = currentMonthISO().slice(0, 7);
  if (active === "tolovlar-tarixi") {
    flat.dan ??= currentMonthISO();
    flat.gacha ??= todayISO();
  }

  const supabase = await createClient();
  const [report, { data: groups }] = await Promise.all([
    buildReport(supabase, active, flat),
    supabase.from("kg_groups").select("id, name").eq("is_active", true).order("name"),
  ]);
  const qs = new URLSearchParams(Object.entries(flat).filter(([k, v]) => v && k !== "tur") as [string, string][]).toString();
  const groupFilter = { type: "select" as const, name: "guruh", label: t("Guruh"), options: (groups ?? []).map((g) => ({ value: g.id, label: g.name })) };
  const filters = {
    "tolovlar": [{ type: "month" as const, name: "oy", label: t("Oy") }, groupFilter],
    "tolovlar-tarixi": [{ type: "date" as const, name: "dan", label: t("Dan") }, { type: "date" as const, name: "gacha", label: t("Gacha") }, groupFilter],
    "qarzdorlar": [groupFilter],
    "bolalar-davomati": [{ type: "month" as const, name: "oy", label: t("Oy") }, groupFilter],
    "xodimlar-davomati": [{ type: "month" as const, name: "oy", label: t("Oy") }],
    "bolalar": [groupFilter],
  }[active];

  return (
    <div>
      <PageHeader title={t("Hisobotlar")} description={t("Hisobotni tanlang, filtrlarni sozlang va Excel yoki PDF formatida yuklab oling")} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {available.map((k) => (
          <Link key={k} href={`/hisobotlar?tur=${k}`} className={cn("rounded-xl border bg-white p-4 transition hover:border-brand-300", k === active ? "border-brand-500 ring-2 ring-brand-500/15" : "border-slate-200")}>
            <p className="flex items-center gap-2 font-medium text-slate-900"><FileBarChart className="h-4 w-4 text-brand-600" />{t(REPORTS[k].title)}</p>
            <p className="mt-1 text-sm text-slate-500">{t(REPORTS[k].description)}</p>
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader title={t(report.title)} description={report.subtitle ? t("{0} · {1} qator", [report.subtitle, report.rows.length]) : t("{0} qator", [report.rows.length])}
          action={<>
            <LinkButton variant="outline" size="sm" prefetch={false} href={`/api/hisobot/${active}?${qs}&format=xlsx`}><FileSpreadsheet className="h-4 w-4" />{" "}{t("Excel")}</LinkButton>
            <LinkButton variant="outline" size="sm" prefetch={false} href={`/api/hisobot/${active}?${qs}&format=pdf`}><FileText className="h-4 w-4" />{" "}{t("PDF")}</LinkButton>
          </>} />
        {filters.length > 0 && <div className="border-b border-slate-100 p-4"><FilterBar filters={filters} /></div>}
        {report.rows.length === 0 ? <EmptyState title={t("Ma'lumot topilmadi")} /> : (
          <Table>
            <THead><tr>{report.columns.map((c) => <TH key={c.key} className={c.type && c.type !== "text" ? "text-right" : undefined}>{t(c.header)}</TH>)}</tr></THead>
            <tbody>
              {report.rows.slice(0, 300).map((r, i) => (
                <TR key={i}>
                  {report.columns.map((c) => (
                    <TD key={c.key} className={c.type && c.type !== "text" ? "whitespace-nowrap text-right tabular-nums" : undefined}>
                      {c.type === "money" || c.type === "number" ? formatNumber(Number(r[c.key])) : c.type === "percent" ? `${r[c.key]}%` : typeof r[c.key] === "string" ? t(r[c.key] as string) : r[c.key]}
                    </TD>
                  ))}
                </TR>
              ))}
              {report.totals && (
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                  {report.columns.map((c) => (
                    <TD key={c.key} className={c.type && c.type !== "text" ? "whitespace-nowrap text-right" : undefined}>
                      {report.totals![c.key] == null ? "" : c.type === "money" || c.type === "number" ? formatNumber(Number(report.totals![c.key])) : report.totals![c.key]}
                    </TD>
                  ))}
                </tr>
              )}
            </tbody>
          </Table>
        )}
        {report.rows.length > 300 && <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">{t("Ekranda birinchi 300 qator ko'rsatildi. To'liq ro'yxat uchun faylni yuklab oling.")}</p>}
      </Card>
    </div>
  );
}
