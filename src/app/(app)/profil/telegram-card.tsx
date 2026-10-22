"use client";
import * as React from "react";
import { toast } from "sonner";
import { Send, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { createTelegramLink, unlinkTelegram } from "./actions";
import { useI18n } from "@/lib/i18n/client";

export function TelegramConnect({ linkedAt, configured }: { linkedAt: string | null; configured: boolean }) {
  const { t } = useI18n();
  const [pending, start] = React.useTransition();
  const [url, setUrl] = React.useState<string | null>(null);

  if (!configured) {
    return <p className="text-sm text-slate-500">{t("Telegram bot hali sozlanmagan. Administrator sozlagach, bu yerda ulash tugmasi paydo bo'ladi.")}</p>;
  }

  if (linkedAt) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-700">{t("✅ Telegram ulangan (")}{formatDateTime(linkedAt)}{t("). Xabarlar ilovada va Telegram'da keladi.")}</p>
        <Button variant="secondary" disabled={pending} onClick={() => start(async () => {
          const r = await unlinkTelegram();
          if (r.ok) toast.success(t(r.message ?? "")); else toast.error(t(r.message ?? ""));
        })}>
          <Unlink className="h-4 w-4" />{" "}{t("Uzish")}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{t("To'lov eslatmalari, e'lonlar va boshqa xabarlarni Telegram'da olish uchun hisobingizni botga ulang.")}</p>
      {url ? (
        <div className="space-y-2">
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-500 px-4 text-sm font-medium text-white hover:bg-sky-600">
            <Send className="h-4 w-4" />{" "}{t("Telegram'da ochish")}</a>
          <p className="text-xs text-slate-500">{t("Botda \"Start\" tugmasini bosing. Havola 15 daqiqa amal qiladi. Ulangach, sahifani yangilang.")}</p>
        </div>
      ) : (
        <Button disabled={pending} onClick={() => start(async () => {
          const r = await createTelegramLink();
          if (r.ok && typeof r.data?.url === "string") setUrl(r.data.url); else toast.error(r.message ?? t("Xatolik"));
        })}>
          <Send className="h-4 w-4" />{" "}{t("Telegram'ni ulash")}</Button>
      )}
    </div>
  );
}
