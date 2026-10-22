import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/labels";
import { PageHeader, InfoRow } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { PasswordForm } from "@/components/password-form";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: g } = user.guardianId
    ? await supabase.from("guardians").select("phone, phone2, address, workplace").eq("id", user.guardianId).single()
    : { data: null };
  const isParent = user.profile.role === "parent";
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Profil" />
      <Card>
        <CardHeader title="Hisob" />
        <CardBody>
          <dl className="divide-y divide-slate-100">
            <InfoRow label="F.I.Sh.">{user.profile.full_name}</InfoRow>
            <InfoRow label="Login"><span className="font-mono">{user.profile.username}</span></InfoRow>
            <InfoRow label="Roli">{ROLE_LABELS[user.profile.role]}</InfoRow>
          </dl>
          <p className="mt-3 text-xs text-slate-500">Ism yoki loginni o&apos;zgartirish uchun administratorga murojaat qiling.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Aloqa ma'lumotlari" description={isParent ? "Bog'cha siz bilan shu raqamlar orqali bog'lanadi" : undefined} />
        <CardBody><ContactForm isParent={isParent} v={g ?? { phone: user.profile.phone }} /></CardBody>
      </Card>
      <Card id="parol">
        <CardHeader title="Parolni almashtirish" />
        <CardBody className="max-w-md"><PasswordForm /></CardBody>
      </Card>
    </div>
  );
}
