import type { Metadata } from "next";
import { TelegramPrompt } from "@/components/telegram-prompt";
import Link from "next/link";
import { CalendarCheck, Wallet, Megaphone, Phone, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyChildren } from "@/lib/parent";
import { ATTENDANCE_STATUS, INVOICE_STATUS } from "@/lib/labels";
import { addMonthsISO, ageFromBirth, currentMonthISO, formatDate, formatDateLong, formatDateTime, formatMonth, formatSom, todayISO } from "@/lib/format";
import { PageHeader, EmptyState, Notice } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { getI18n } from "@/lib/i18n/server";
import { Avatar } from "@/components/avatar";
import { AbsenceCard, type AbsenceReport } from "./absence";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Bosh sahifa") };
}

export default async function ParentHome() {
  const { t, f } = await getI18n();
  const user = await requireUser(["parent"]);
  const supabase = await createClient();
  const kids = await getMyChildren(supabase, user.guardianId);
  const ids = kids.map((k) => k.id);
  const today = todayISO();
  const month = currentMonthISO();
  const none = ["00000000-0000-0000-0000-000000000000"];

  const [{ data: att }, { data: invoices }, { data: news }, { data: s }, { data: reports }] = await Promise.all([
    supabase.from("child_attendance").select("child_id, date, status").in("child_id", ids.length ? ids : none).gte("date", month).lt("date", addMonthsISO(month, 1)),
    supabase.from("invoices").select("child_id, period, amount_due, paid_total, balance, status, due_date").in("child_id", ids.length ? ids : none).lte("period", month),
    supabase.from("announcements").select("id, title, body, created_at").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(3),
    supabase.from("settings").select("kindergarten_name, phone").eq("id", 1).single(),
    supabase.from("absence_reports").select("id, child_id, date, note").in("child_id", ids.length ? ids : none).gte("date", today).order("date"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("Assalomu alaykum, {0}!", [user.profile.full_name.split(" ")[1] ?? user.profile.full_name])} description={f.formatDateLong(today)} />
      <TelegramPrompt linkedAt={user.profile.telegram_linked_at} />
      {kids.length === 0 ? (
        <Card><EmptyState title={t("Hisobingizga hali bola bog'lanmagan")} description={t("Bog'cha administratoriga murojaat qiling.")} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {kids.map((k) => {
            const todayRec = (att ?? []).find((a) => a.child_id === k.id && a.date === today);
            const monthAtt = (att ?? []).filter((a) => a.child_id === k.id);
            const cur = (invoices ?? []).find((i) => i.child_id === k.id && i.period === month);
            const debt = (invoices ?? []).filter((i) => i.child_id === k.id).reduce((s, i) => s + Math.max(0, Number(i.balance)), 0);
            return (
              <Card key={k.id} className="overflow-hidden">
                <div className="flex items-center gap-4 bg-gradient-to-r from-brand-50 to-mint-50 px-5 py-4">
                  <Avatar kind="child" id={k.id} name={k.full_name} version={k.photo_updated_at} size="lg" />
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-slate-900">{k.full_name}</p>
                    <p className="text-sm text-slate-600">{k.kg_groups?.name ?? t("Guruhsiz")} · {f.ageFromBirth(k.birth_date)}</p>
                    {k.birth_date.slice(5) === today.slice(5) && <p className="mt-1 text-sm font-medium text-pink-600">🎂 {t("Bugun tug'ilgan kuni! Tabriklaymiz!")}</p>}
                  </div>
                </div>
                <CardBody className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-slate-600"><CalendarCheck className="h-4 w-4 text-slate-400" />{" "}{t("Bugun")}</span>
                    {todayRec ? <StatusBadge map={ATTENDANCE_STATUS} value={todayRec.status} /> : <Badge>{t("Hali belgilanmagan")}</Badge>}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{t("Shu oy kelgan kunlar")}</span>
                    <span className="font-medium">{monthAtt.filter((a) => a.status === "present" || a.status === "late").length} / {monthAtt.length}</span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-700"><Wallet className="h-4 w-4 text-slate-400" /> {f.formatMonth(month)}{" "}{t("to'lovi")}</span>
                      {cur ? <StatusBadge map={INVOICE_STATUS} value={cur.status} /> : <Badge>{t("Hisob yo'q")}</Badge>}
                    </div>
                    {cur ? (
                      <dl className="grid gap-1.5 text-sm sm:grid-cols-3 sm:gap-2 sm:text-center">
                        <div className="flex justify-between sm:block"><dt className="text-slate-500 sm:text-xs">{t("Oylik")}</dt><dd className="font-semibold">{f.formatSom(cur.amount_due)}</dd></div>
                        <div className="flex justify-between sm:block"><dt className="text-slate-500 sm:text-xs">{t("To'langan")}</dt><dd className="font-semibold text-mint-700">{f.formatSom(cur.paid_total)}</dd></div>
                        <div className="flex justify-between sm:block"><dt className="text-slate-500 sm:text-xs">{t("Qoldiq")}</dt><dd className="font-semibold text-red-600">{f.formatSom(Math.max(0, cur.balance))}</dd></div>
                      </dl>
                    ) : <p className="text-sm text-slate-500">{t("Bu oy uchun hisob hali yaratilmagan.")}</p>}
                    {cur && cur.balance > 0 && <p className="mt-2 text-xs text-slate-500">{t("To'lov muddati:")}{" "}{formatDate(cur.due_date)}</p>}
                  </div>
                  {debt > 0 && (!cur || debt > Number(cur.balance)) && (
                    <Notice tone="amber">{t("Umumiy qarzdorlik (oldingi oylar bilan):")}{" "}<b>{f.formatSom(debt)}</b></Notice>
                  )}
                  <AbsenceCard childId={k.id} childName={k.full_name} today={today}
                    reports={((reports ?? []) as (AbsenceReport & { child_id: string })[]).filter((r) => r.child_id === k.id)} />
                  <div className="flex gap-4 text-sm">
                    <Link href={`/ota-ona/davomat?bola=${k.id}`} className="inline-flex items-center gap-1 font-medium text-brand-700">{t("Davomat")}{" "}<ChevronRight className="h-4 w-4" /></Link>
                    <Link href={`/ota-ona/tolovlar?bola=${k.id}`} className="inline-flex items-center gap-1 font-medium text-brand-700">{t("To'lovlar")}{" "}<ChevronRight className="h-4 w-4" /></Link>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("E'lonlar")} action={<Link href="/elonlar" className="text-sm text-brand-700">{t("Barchasi")}</Link>} />
          <CardBody className="space-y-4">
            {(news ?? []).length === 0 ? <p className="text-sm text-slate-500">{t("Yangi e'lonlar yo'q")}</p> : (news ?? []).map((n) => (
              <div key={n.id} className="flex gap-3">
                <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <div className="min-w-0"><p className="font-medium text-slate-900">{n.title}</p><p className="line-clamp-2 text-sm text-slate-600">{n.body}</p><p className="mt-0.5 text-xs text-slate-400">{formatDateTime(n.created_at)}</p></div>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("Bog'cha bilan aloqa")} />
          <CardBody className="space-y-2 text-sm">
            <p className="font-medium">{s?.kindergarten_name}</p>
            {s?.phone && <a href={`tel:${s.phone}`} className="flex items-center gap-2 text-brand-700"><Phone className="h-4 w-4" />{s.phone}</a>}
            <Link href="/ota-ona/aloqa" className="inline-block text-brand-700">{t("Barcha aloqa ma'lumotlari →")}</Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
