import type { Metadata } from "next";
import Link from "next/link";
import { Phone, Mail, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { connection } from "next/server";
import { env } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Parolni tiklash") };
}

async function getContacts() {
  await connection();
  if (!env.isConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data } = await createAdminClient().from("settings").select("kindergarten_name, phone, phone2, email").eq("id", 1).maybeSingle();
  return data;
}

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  const s = await getContacts();
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">{t("Parolni tiklash")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("Xavfsizlik maqsadida parolni faqat bog'cha administratori tiklaydi. Administrator sizga vaqtinchalik parol beradi, birinchi kirishda uni o'zingizning yangi parolingizga almashtirasiz.")}</p>
      {s && (s.phone || s.email) && (
        <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
          <p className="font-medium text-slate-800">{s.kindergarten_name}</p>
          {s.phone && <a href={`tel:${s.phone}`} className="flex items-center gap-2 text-brand-700"><Phone className="h-4 w-4" />{s.phone}</a>}
          {s.phone2 && <a href={`tel:${s.phone2}`} className="flex items-center gap-2 text-brand-700"><Phone className="h-4 w-4" />{s.phone2}</a>}
          {s.email && <a href={`mailto:${s.email}`} className="flex items-center gap-2 text-brand-700"><Mail className="h-4 w-4" />{s.email}</a>}
        </div>
      )}
      <Link href="/kirish" className="mt-6 inline-block text-sm font-medium text-brand-700 hover:underline">{t("← Kirish sahifasiga qaytish")}</Link>
    </div>
  );
}
