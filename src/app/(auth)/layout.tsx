import { Sun } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-br from-brand-50 via-white to-mint-50">
      <div className="flex justify-end px-4 pt-4">
        <LanguageSwitcher className="bg-white/80 shadow-sm ring-1 ring-slate-200" />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-10 pt-4">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/25">
              <Sun className="h-7 w-7" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t("Bog'cha boshqaruv tizimi")}</h1>
            <p className="mt-1 text-sm text-slate-500">{t("Xodimlar, ota-onalar va rahbariyat uchun yagona tizim")}</p>
          </div>
          {children}
        </div>
      </div>
      <p className="pb-6 text-center text-xs text-slate-400">{t("Ma'lumotlaringiz himoyalangan · Toshkent vaqti (UTC+5)")}</p>
    </div>
  );
}
