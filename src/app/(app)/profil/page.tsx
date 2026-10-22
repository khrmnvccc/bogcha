import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/labels";
import { PageHeader, InfoRow } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { PasswordForm } from "@/components/password-form";
import { ContactForm } from "./contact-form";
import { TelegramConnect } from "./telegram-card";
import { telegramConfigured } from "@/lib/integrations/telegram";
import { getI18n } from "@/lib/i18n/server";
import { PhotoUpload } from "@/components/photo-upload";
import { InstallCard } from "@/components/pwa";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Profil") };
}

export default async function ProfilePage() {
  const { t } = await getI18n();
  const user = await requireUser();
  const supabase = await createClient();
  const { data: g } = user.guardianId
    ? await supabase.from("guardians").select("phone, phone2, address, workplace").eq("id", user.guardianId).single()
    : { data: null };
  const { data: emp } = user.employeeId
    ? await supabase.from("employees").select("photo_updated_at").eq("id", user.employeeId).single()
    : { data: null };
  const isParent = user.profile.role === "parent";
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("Profil")} description={user.profile.full_name}
        leading={user.employeeId ? <PhotoUpload kind="employee" id={user.employeeId} name={user.profile.full_name} version={emp?.photo_updated_at} editable /> : undefined} />
      <Card>
        <CardHeader title={t("Hisob")} />
        <CardBody>
          <dl className="divide-y divide-slate-100">
            <InfoRow label={t("F.I.Sh.")}>{user.profile.full_name}</InfoRow>
            <InfoRow label={t("Login")}><span className="font-mono">{user.profile.username}</span></InfoRow>
            <InfoRow label={t("Roli")}>{t(ROLE_LABELS[user.profile.role])}</InfoRow>
          </dl>
          <p className="mt-3 text-xs text-slate-500">{t("Ism yoki loginni o'zgartirish uchun administratorga murojaat qiling.")}</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("Aloqa ma'lumotlari")} description={isParent ? t("Bog'cha siz bilan shu raqamlar orqali bog'lanadi") : undefined} />
        <CardBody><ContactForm isParent={isParent} v={g ?? { phone: user.profile.phone }} /></CardBody>
      </Card>
      <Card id="ilova">
        <CardHeader title={t("Ilova (telefon va kompyuter)")} />
        <CardBody><InstallCard /></CardBody>
      </Card>
      <Card id="telegram">
        <CardHeader title={t("Telegram xabarnomalari")} />
        <CardBody><TelegramConnect linkedAt={user.profile.telegram_linked_at} configured={telegramConfigured()} /></CardBody>
      </Card>
      <Card id="parol">
        <CardHeader title={t("Parolni almashtirish")} />
        <CardBody className="max-w-md"><PasswordForm /></CardBody>
      </Card>
    </div>
  );
}
