"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">{t("Sahifani yuklashda xatolik yuz berdi")}</h2>
      <p className="mt-2 text-sm text-slate-500">{t("Internet aloqasini tekshirib, qayta urinib ko'ring. Muammo takrorlansa, administratorga xabar bering.")}</p>
      <Button className="mt-6" onClick={reset}>{t("Qayta urinish")}</Button>
    </div>
  );
}
