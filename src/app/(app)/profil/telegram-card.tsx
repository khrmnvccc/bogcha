"use client";
import * as React from "react";
import { toast } from "sonner";
import { Send, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { createTelegramLink, unlinkTelegram } from "./actions";

export function TelegramConnect({ linkedAt, configured }: { linkedAt: string | null; configured: boolean }) {
  const [pending, start] = React.useTransition();
  const [url, setUrl] = React.useState<string | null>(null);

  if (!configured) {
    return <p className="text-sm text-slate-500">Telegram bot hali sozlanmagan. Administrator sozlagach, bu yerda ulash tugmasi paydo bo&apos;ladi.</p>;
  }

  if (linkedAt) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-700">✅ Telegram ulangan ({formatDateTime(linkedAt)}). Xabarlar ilovada va Telegram&apos;da keladi.</p>
        <Button variant="secondary" disabled={pending} onClick={() => start(async () => {
          const r = await unlinkTelegram();
          if (r.ok) toast.success(r.message); else toast.error(r.message);
        })}>
          <Unlink className="h-4 w-4" /> Uzish
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        To&apos;lov eslatmalari, e&apos;lonlar va boshqa xabarlarni Telegram&apos;da olish uchun hisobingizni botga ulang.
      </p>
      {url ? (
        <div className="space-y-2">
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-500 px-4 text-sm font-medium text-white hover:bg-sky-600">
            <Send className="h-4 w-4" /> Telegram&apos;da ochish
          </a>
          <p className="text-xs text-slate-500">Botda &quot;Start&quot; tugmasini bosing. Havola 15 daqiqa amal qiladi. Ulangach, sahifani yangilang.</p>
        </div>
      ) : (
        <Button disabled={pending} onClick={() => start(async () => {
          const r = await createTelegramLink();
          if (r.ok && typeof r.data?.url === "string") setUrl(r.data.url); else toast.error(r.message ?? "Xatolik");
        })}>
          <Send className="h-4 w-4" /> Telegram&apos;ni ulash
        </Button>
      )}
    </div>
  );
}
