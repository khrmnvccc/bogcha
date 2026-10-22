import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTelegram, telegramConfigured } from "@/lib/integrations/telegram";
import { sendSms, smsConfigured } from "@/lib/integrations/sms";

/** Delivers queued messages. Unconfigured channels are marked "skipped", never "sent". */
export async function dispatchPending(limit = 50) {
  const result = { sent: 0, failed: 0, skipped: 0 };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return result;
  const admin = createAdminClient();
  const { data: queue } = await admin.from("outbound_messages").select("*").eq("status", "pending").order("created_at").limit(limit);
  for (const m of queue ?? []) {
    const configured = m.channel === "telegram" ? telegramConfigured() : smsConfigured();
    if (!configured) {
      await admin.from("outbound_messages").update({ status: "skipped", last_error: "Kanal sozlanmagan" }).eq("id", m.id);
      result.skipped++;
      continue;
    }
    try {
      if (m.channel === "telegram") await sendTelegram(m.recipient, m.body);
      else await sendSms(m.recipient, m.body);
      await admin.from("outbound_messages").update({ status: "sent", sent_at: new Date().toISOString(), attempts: m.attempts + 1, last_error: null }).eq("id", m.id);
      result.sent++;
    } catch (e) {
      const attempts = m.attempts + 1;
      await admin.from("outbound_messages").update({
        status: attempts >= 3 ? "failed" : "pending", attempts, last_error: (e as Error).message.slice(0, 300),
      }).eq("id", m.id);
      result.failed++;
    }
  }
  return result;
}

export function anyChannelConfigured() {
  return telegramConfigured() || smsConfigured();
}
