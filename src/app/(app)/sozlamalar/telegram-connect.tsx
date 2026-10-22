"use client";
import * as React from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectTelegramBot } from "./actions";
import { useI18n } from "@/lib/i18n/client";

export function ConnectBotButton() {
  const { t } = useI18n();
  const [pending, start] = React.useTransition();
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
      const r = await connectTelegramBot();
      if (r.ok) toast.success(t(r.message ?? "")); else toast.error(t(r.message ?? ""));
    })}>
      <Send className="h-3.5 w-3.5" /> {pending ? t("Ulanmoqda...") : t("Botni saytga ulash")}
    </Button>
  );
}
