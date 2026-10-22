import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTelegram, telegramWebhookSecret } from "@/lib/integrations/telegram";

type Update = { message?: { text?: string; chat?: { id: number; type: string }; from?: { first_name?: string } } };

function secretMatches(header: string | null): boolean {
  const secret = telegramWebhookSecret();
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const HELP =
  "Assalomu alaykum! Bu bog'cha boshqaruv tizimining boti.\n\n" +
  "Hisobingizni ulash uchun saytga kiring: Profil → \"Telegram'ni ulash\" tugmasini bosing. " +
  "Shundan so'ng to'lov eslatmalari, e'lonlar va boshqa xabarlar shu yerga keladi.\n\n" +
  "Xabarlarni to'xtatish: /stop";

/** Telegram webhook: links accounts via /start <code>, unlinks via /stop. */
export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const update = (await req.json().catch(() => null)) as Update | null;
  const msg = update?.message;
  // Only private chats; always answer 200 so Telegram does not retry.
  if (!msg?.chat || msg.chat.type !== "private" || !msg.text) return NextResponse.json({ ok: true });
  const chatId = String(msg.chat.id);
  const text = msg.text.trim();
  const admin = createAdminClient();

  try {
    const start = /^\/start(?:\s+([a-f0-9]{24}))?$/i.exec(text);
    if (start?.[1]) {
      const { data: name, error } = await admin.rpc("link_telegram", { p_code: start[1].toLowerCase(), p_chat_id: chatId });
      if (error) throw error;
      await sendTelegram(chatId, name
        ? `✅ ${name}, hisobingiz ulandi. Endi bog'chadan keladigan xabarlar shu yerga ham yuboriladi.\n\nTo'xtatish: /stop`
        : "Havola eskirgan yoki noto'g'ri. Saytdagi Profil sahifasidan yangi havola oling.");
    } else if (/^\/stop\b/i.test(text)) {
      const { data: removed } = await admin.rpc("unlink_telegram_chat", { p_chat_id: chatId });
      await sendTelegram(chatId, removed
        ? "Hisobingiz uzildi, Telegram orqali xabar yuborilmaydi. Qayta ulash uchun saytdagi Profil sahifasiga kiring."
        : "Bu chat hech qaysi hisobga ulanmagan.");
    } else {
      await sendTelegram(chatId, HELP);
    }
  } catch (e) {
    console.error("[telegram webhook]", (e as Error).message);
  }
  return NextResponse.json({ ok: true });
}
