import { NextResponse, type NextRequest } from "next/server";
import { bearerMatches } from "@/lib/integrations/secret";
import { dispatchPending } from "@/lib/integrations/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Scheduled job ("Authorization: Bearer $CRON_SECRET"): queues due reminders
 * (payments, staff check-in/out, attendance, daily summary), then delivers
 * queued Telegram/SMS messages.
 */
export async function GET(req: NextRequest) {
  if (!bearerMatches(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: reminders, error } = await createAdminClient().rpc("run_scheduled_reminders");
  if (error) console.error("[reminders]", error.message);
  const delivery = await dispatchPending(200);
  return NextResponse.json({ reminders: reminders ?? null, delivery });
}
