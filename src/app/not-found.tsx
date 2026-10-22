import { LinkButton } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <h1 className="mt-3 text-lg font-semibold text-slate-900">{t("Sahifa topilmadi")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("Bu sahifa mavjud emas yoki uni ko'rishga ruxsatingiz yo'q.")}</p>
      <LinkButton href="/" className="mt-6">{t("Bosh sahifaga qaytish")}</LinkButton>
    </div>
  );
}
