import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { getCurrentUser, homePathFor } from "@/lib/auth";
import { env } from "@/lib/env";
import { Notice } from "@/components/ui/misc";
import { sp } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Tizimga kirish") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getI18n();
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user?.profile.is_active) redirect(homePathFor(user.profile.role));

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
      <h2 className="text-lg font-semibold text-slate-900">{t("Tizimga kirish")}</h2>
      <p className="mb-6 mt-1 text-sm text-slate-500">{t("Administrator bergan login va parolni kiriting")}</p>
      {!env.isConfigured() && (
        <Notice tone="amber" className="mb-4">{t("Supabase sozlanmagan.")}{" "}<code>{t(".env.local")}</code>{" "}{t("faylida")}{" "}<code>{t("NEXT_PUBLIC_SUPABASE_URL")}</code>{" "}{t("va")}{" "}
          <code>{t("NEXT_PUBLIC_SUPABASE_ANON_KEY")}</code>{" "}{t("qiymatlarini kiriting.")}</Notice>
      )}
      {sp(params.xato) === "faol-emas" && (
        <Notice tone="red" className="mb-4">{t("Hisobingiz faol emas. Administrator bilan bog'laning.")}</Notice>
      )}
      <LoginForm next={sp(params.keyin)} />
      <div className="mt-6 text-center">
        <Link href="/parol-tiklash" className="text-sm font-medium text-brand-700 hover:underline">{t("Parolni unutdingizmi?")}</Link>
      </div>
    </div>
  );
}
