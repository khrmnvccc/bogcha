import "server-only";

// Eskiz.uz SMS gateway (https://documenter.getpostman.com/view/663428/RzfmES4z).
const BASE = "https://notify.eskiz.uz/api";
let cachedToken: { value: string; at: number } | null = null;

export function smsConfigured() {
  return Boolean(process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD);
}

async function token(): Promise<string> {
  if (cachedToken && Date.now() - cachedToken.at < 20 * 60 * 60 * 1000) return cachedToken.value;
  const fd = new FormData();
  fd.set("email", process.env.ESKIZ_EMAIL!);
  fd.set("password", process.env.ESKIZ_PASSWORD!);
  const res = await fetch(`${BASE}/auth/login`, { method: "POST", body: fd, signal: AbortSignal.timeout(10_000) });
  const body = (await res.json().catch(() => ({}))) as { data?: { token?: string }; message?: string };
  if (!res.ok || !body.data?.token) throw new Error(`Eskiz login: ${body.message ?? res.status}`);
  cachedToken = { value: body.data.token, at: Date.now() };
  return cachedToken.value;
}

/** Normalises Uzbek numbers to 998XXXXXXXXX. */
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("998")) return digits;
  if (digits.length === 9) return `998${digits}`;
  return null;
}

export async function sendSms(phone: string, text: string): Promise<void> {
  if (!smsConfigured()) throw new Error("SMS sozlanmagan");
  const to = normalizePhone(phone);
  if (!to) throw new Error("Telefon raqami noto'g'ri");
  const fd = new FormData();
  fd.set("mobile_phone", to);
  fd.set("message", text.slice(0, 480));
  fd.set("from", process.env.ESKIZ_FROM || "4546");
  const res = await fetch(`${BASE}/message/sms/send`, {
    method: "POST", body: fd, headers: { Authorization: `Bearer ${await token()}` }, signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`Eskiz: ${body.message ?? res.status}`);
  }
}
