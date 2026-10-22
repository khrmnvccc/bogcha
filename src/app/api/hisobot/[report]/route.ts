import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildReport, canRunReport, REPORTS, type ReportKey } from "@/lib/reports";
import { toXlsx } from "@/lib/export/excel";
import { toPdf } from "@/lib/export/pdf";

export async function GET(req: NextRequest, ctx: { params: Promise<{ report: string }> }) {
  const { report } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !user.profile.is_active) return NextResponse.json({ error: "Tizimga kiring" }, { status: 401 });
  if (!(report in REPORTS) || !canRunReport(user, report as ReportKey)) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const supabase = await createClient();
  const r = await buildReport(supabase, report as ReportKey, params);
  const format = params.format === "pdf" ? "pdf" : "xlsx";
  const body = format === "pdf" ? toPdf(r) : await toXlsx(r);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${r.filename}.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
