import "server-only";

export function integrationStatus() {
  return [
    { key: "telegram", name: "Telegram bot", configured: Boolean(process.env.TELEGRAM_BOT_TOKEN), hint: "TELEGRAM_BOT_TOKEN. Ota-ona kartasida Telegram chat ID ko'rsatilishi kerak." },
    { key: "sms", name: "SMS (Eskiz.uz)", configured: Boolean(process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD), hint: "ESKIZ_EMAIL, ESKIZ_PASSWORD, ESKIZ_FROM" },
    { key: "biometric", name: "Biometrik qurilma", configured: Boolean(process.env.BIOMETRIC_DEVICE_TOKEN), hint: "BIOMETRIC_DEVICE_TOKEN. Qurilma /api/integrations/biometric manziliga so'rov yuboradi." },
    { key: "cron", name: "Xabarlarni yuborish (cron)", configured: Boolean(process.env.CRON_SECRET), hint: "CRON_SECRET. /api/integrations/dispatch har 5 daqiqada chaqiriladi." },
  ];
}
