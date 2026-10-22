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

export const metadata: Metadata = { title: "Sozlamalar" };

export default async function SettingsPage() {
  await requireUser(ADMIN_ROLES);
  const supabase = await createClient();
  const [settings, { data: periods }, { count: pending }] = await Promise.all([
    getSettings(supabase),
    supabase.from("academic_periods").select("*").order("start_date", { ascending: false }),
    supabase.from("outbound_messages").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const integrations = integrationStatus();
  return (
    <div className="space-y-6">
      <PageHeader title="Sozlamalar" description="Bog'cha ma'lumotlari, to'lov va ish jadvali qoidalari" />
      <Card><CardBody><SettingsForm s={settings} /></CardBody></Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="O'quv davrlari" action={<PeriodDialog />} />
          <ul className="divide-y divide-slate-100">
            {(periods ?? []).length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Hali o&apos;quv davri qo&apos;shilmagan</li>}
            {(periods ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span><b>{p.name}</b> <span className="text-slate-500">· {formatDate(p.start_date)} – {formatDate(p.end_date)}</span></span>
                {p.is_current ? <Badge tone="green">Joriy</Badge> : (
                  <ConfirmAction trigger={<Button variant="ghost" size="sm">Joriy qilish</Button>} title="Joriy o'quv davri qilinsinmi?" description={p.name}
                    action={setCurrentPeriod} hidden={{ id: p.id }} danger={false} confirmText="Tasdiqlash" />
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Integratsiyalar" description="Server muhit o'zgaruvchilari orqali sozlanadi" />
          <CardBody className="space-y-3 text-sm">
            {integrations.map((i) => (
              <div key={i.key} className="flex items-start justify-between gap-3">
                <div><p className="font-medium text-slate-900">{i.name}</p><p className="text-xs text-slate-500">{i.hint}</p></div>
                {i.configured ? <Badge tone="green">Sozlangan</Badge> : <Badge>Sozlanmagan</Badge>}
              </div>
            ))}
            <p className="pt-2 text-xs text-slate-500">Navbatda yuborilmagan xabarlar: {pending ?? 0}. Sozlanmagan kanal uchun xabarlar yuborilmaydi va &quot;yuborildi&quot; deb ko&apos;rsatilmaydi.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
