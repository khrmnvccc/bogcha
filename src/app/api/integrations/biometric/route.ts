import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearerMatches } from "@/lib/integrations/secret";

const body = z.object({ employee_id: z.string().uuid(), kind: z.enum(["in", "out"]) });

/**
 * Endpoint for a biometric / face-ID terminal. The device must send
 * "Authorization: Bearer $BIOMETRIC_DEVICE_TOKEN" and {"employee_id": "...", "kind": "in"|"out"}.
 * Records are stored with source "biometric" and the server's timestamp.
 */
export async function POST(req: NextRequest) {
  if (!process.env.BIOMETRIC_DEVICE_TOKEN) return NextResponse.json({ error: "Biometrik integratsiya sozlanmagan" }, { status: 503 });
  if (!bearerMatches(req.headers.get("authorization"), process.env.BIOMETRIC_DEVICE_TOKEN)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Noto'g'ri so'rov" }, { status: 400 });
  const { data, error } = await createAdminClient().rpc("device_check", { p_employee_id: parsed.data.employee_id, p_kind: parsed.data.kind });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ ok: true, work_date: data.work_date, check_in_at: data.check_in_at, check_out_at: data.check_out_at });
}
