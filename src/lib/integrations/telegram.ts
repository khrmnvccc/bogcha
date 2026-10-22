import "server-only";
import { createHash } from "node:crypto";

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

async function callTelegram<T>(method: string, payload: Record<string, unknown> = {}): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN sozlanmagan");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: T };
  if (!res.ok || !body.ok) throw new Error(`Telegram: ${body.description ?? res.status}`);
  return body.result as T;
}

/** Sends a plain-text message via the Telegram Bot API. Throws on failure. */
export async function sendTelegram(chatId: string, text: string): Promise<void> {
  await callTelegram("sendMessage", { chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true });
}

/**
 * Secret Telegram sends back in the X-Telegram-Bot-Api-Secret-Token header.
 * Derived from the bot token so no extra environment variable is needed.
 */
export function telegramWebhookSecret(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  return createHash("sha256").update(`bogcha-webhook:${token}`).digest("hex").slice(0, 48);
}

let cachedUsername: string | null = null;

/** The bot's @username (without @), from TELEGRAM_BOT_USERNAME or getMe. */
export async function telegramBotUsername(): Promise<string | null> {
  if (!telegramConfigured()) return null;
  if (process.env.TELEGRAM_BOT_USERNAME) return process.env.TELEGRAM_BOT_USERNAME.replace(/^@/, "");
  if (cachedUsername) return cachedUsername;
  try {
    const me = await callTelegram<{ username?: string }>("getMe");
    cachedUsername = me.username ?? null;
  } catch (e) {
    console.error("[telegram] getMe", (e as Error).message);
  }
  return cachedUsername;
}

/** Points the bot at this app's webhook so /start links can connect accounts. */
export async function registerTelegramWebhook(appUrl: string): Promise<string> {
  const url = `${appUrl.replace(/\/$/, "")}/api/integrations/telegram`;
  await callTelegram("setWebhook", {
    url,
    secret_token: telegramWebhookSecret(),
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
  await callTelegram("setMyCommands", {
    commands: [
      { command: "start", description: "Hisobni ulash" },
      { command: "stop", description: "Xabarlarni to'xtatish" },
    ],
  }).catch(() => undefined);
  return url;
}
