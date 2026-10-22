import Link from "next/link";
import { Send } from "lucide-react";
import { telegramConfigured } from "@/lib/integrations/telegram";
import { T } from "@/lib/i18n/client";

/** Nudges users who have not connected Telegram yet (only when the bot is configured). */
export function TelegramPrompt({ linkedAt }: { linkedAt: string | null }) {
  if (linkedAt || !telegramConfigured()) return null;
  return (
    <Link href="/profil#telegram"
      className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 hover:bg-sky-100">
      <Send className="h-4 w-4 shrink-0 text-sky-600" />
      <span className="flex-1"><T>{"Eslatma va xabarlarni Telegram'da olish uchun hisobingizni botga ulang."}</T></span>
      <span className="shrink-0 font-medium text-sky-700"><T>{"Ulash →"}</T></span>
    </Link>
  );
}
