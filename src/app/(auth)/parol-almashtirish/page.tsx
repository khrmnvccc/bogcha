import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Notice } from "@/components/ui/misc";
import { PasswordForm } from "@/components/password-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Yangi parol o'rnatish") };
}

export default async function ForcePasswordPage() {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user) redirect("/kirish");
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
      <h2 className="text-lg font-semibold text-slate-900">{t("Yangi parol o'rnating")}</h2>
      <Notice tone="blue" className="my-4">{t("Xush kelibsiz,")}{" "}{user.profile.full_name}{t("! Xavfsizlik uchun administrator bergan vaqtinchalik parolni o'zingiz biladigan yangi parolga almashtiring.")}</Notice>
      <PasswordForm forced />
    </div>
  );
}
