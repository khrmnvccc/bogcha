import { NextResponse, type NextRequest } from "next/server";
import { bearerMatches } from "@/lib/integrations/secret";
import { dispatchPending } from "@/lib/integrations/dispatch";

/** Scheduled delivery of queued Telegram/SMS messages ("Authorization: Bearer $CRON_SECRET"). */
export async function GET(req: NextRequest) {
  if (!bearerMatches(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await dispatchPending());
}
