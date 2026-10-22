import { getI18n } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { InstallButton } from "@/components/pwa";

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" className="mb-4 h-16 w-16 rounded-2xl shadow-lg shadow-brand-600/25" />
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t("Bog'cha boshqaruv tizimi")}</h1>
            <p className="mt-1 text-sm text-slate-500">{t("Xodimlar, ota-onalar va rahbariyat uchun yagona tizim")}</p>
          </div>
          {children}
          <div className="mt-4 flex justify-center"><InstallButton className="bg-white/80" /></div>
        </div>
      </div>
      <p className="pb-6 text-center text-xs text-slate-400">{t("Ma'lumotlaringiz himoyalangan · Toshkent vaqti (UTC+5)")}</p>
    </div>
  );
}
