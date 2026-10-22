import type { Metadata } from "next";
import { requireUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { integrationStatus } from "@/lib/integrations/status";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmAction } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SettingsForm, PeriodDialog } from "./forms";
import { setCurrentPeriod } from "./actions";
import { ConnectBotButton } from "./telegram-connect";
import { telegramBotUsername } from "@/lib/integrations/telegram";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Sozlamalar") };
}

export default async function SettingsPage() {
  const { t } = await getI18n();
  await requireUser(ADMIN_ROLES);
  const supabase = await createClient();
  const [settings, { data: periods }, { count: pending }, { count: linked }, botUsername] = await Promise.all([
    getSettings(supabase),
    supabase.from("academic_periods").select("*").order("start_date", { ascending: false }),
    supabase.from("outbound_messages").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).not("telegram_chat_id", "is", null),
    telegramBotUsername(),
  ]);
  const integrations = integrationStatus();
  return (
    <div className="space-y-6">
      <PageHeader title={t("Sozlamalar")} description={t("Bog'cha ma'lumotlari, to'lov va ish jadvali qoidalari")} />
      <Card><CardBody><SettingsForm s={settings} /></CardBody></Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("O'quv davrlari")} action={<PeriodDialog />} />
          <ul className="divide-y divide-slate-100">
            {(periods ?? []).length === 0 && <li className="px-5 py-4 text-sm text-slate-500">{t("Hali o'quv davri qo'shilmagan")}</li>}
            {(periods ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span><b>{p.name}</b> <span className="text-slate-500">· {formatDate(p.start_date)} – {formatDate(p.end_date)}</span></span>
                {p.is_current ? <Badge tone="green">{t("Joriy")}</Badge> : (
                  <ConfirmAction trigger={<Button variant="ghost" size="sm">{t("Joriy qilish")}</Button>} title={t("Joriy o'quv davri qilinsinmi?")} description={p.name}
                    action={setCurrentPeriod} hidden={{ id: p.id }} danger={false} confirmText={t("Tasdiqlash")} />
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title={t("Integratsiyalar")} description={t("Server muhit o'zgaruvchilari orqali sozlanadi")} />
          <CardBody className="space-y-3 text-sm">
            {integrations.map((i) => (
              <div key={i.key} className="flex items-start justify-between gap-3">
                <div><p className="font-medium text-slate-900">{t(i.name)}</p><p className="break-words text-xs text-slate-500">{t(i.hint)}</p></div>
                {i.configured ? <Badge tone="green">{t("Sozlangan")}</Badge> : <Badge>{t("Sozlanmagan")}</Badge>}
              </div>
            ))}
            {integrations.find((i) => i.key === "telegram")?.configured && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-600">
                  {botUsername ? <>{t("Bot:")}{" "}<b>@{botUsername}</b> · </> : null}{t("Telegram ulagan foydalanuvchilar:")}{" "}<b>{linked ?? 0}</b>
                </p>
                <ConnectBotButton />
              </div>
            )}
            <p className="pt-2 text-xs text-slate-500">{t("Navbatda yuborilmagan xabarlar:")}{" "}{pending ?? 0}{t(". Sozlanmagan kanal uchun xabarlar yuborilmaydi va \"yuborildi\" deb ko'rsatilmaydi.")}</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
