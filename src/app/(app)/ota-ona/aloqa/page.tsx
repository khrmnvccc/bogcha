import type { Metadata } from "next";
import { Phone, Mail, MapPin, Clock, Send } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";

export const metadata: Metadata = { title: "Bog'cha bilan aloqa" };

export default async function ContactPage() {
  await requireUser();
  const supabase = await createClient();
  const { data: s } = await supabase.from("settings").select("kindergarten_name, address, phone, phone2, email, telegram, working_hours_text").eq("id", 1).single();
  const tg = s?.telegram?.replace(/^@/, "");
  const items = [
    s?.phone && { icon: Phone, label: "Telefon", value: s.phone, href: `tel:${s.phone}` },
    s?.phone2 && { icon: Phone, label: "Qo'shimcha telefon", value: s.phone2, href: `tel:${s.phone2}` },
    s?.email && { icon: Mail, label: "Elektron pochta", value: s.email, href: `mailto:${s.email}` },
    tg && { icon: Send, label: "Telegram", value: `@${tg}`, href: `https://t.me/${encodeURIComponent(tg)}` },
    s?.address && { icon: MapPin, label: "Manzil", value: s.address },
    s?.working_hours_text && { icon: Clock, label: "Ish vaqti", value: s.working_hours_text },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string }[];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Bog'cha bilan aloqa" description={s?.kindergarten_name} />
      <Card>
        <CardBody className="divide-y divide-slate-100 p-0">
          {items.length === 0 && <p className="p-5 text-sm text-slate-500">Aloqa ma&apos;lumotlari hali kiritilmagan.</p>}
          {items.map((it) => (
            <div key={it.label} className="flex items-center gap-4 px-5 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><it.icon className="h-5 w-5" /></span>
              <div>
                <p className="text-xs text-slate-500">{it.label}</p>
                {it.href ? <a href={it.href} className="font-medium text-brand-700" target={it.href.startsWith("http") ? "_blank" : undefined} rel="noopener">{it.value}</a> : <p className="font-medium text-slate-900">{it.value}</p>}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
