import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pdfText } from "@/lib/export/pdf";
import { formatDate, formatDateTime, formatMonth, formatSom } from "@/lib/format";
import { PAYMENT_METHOD } from "@/lib/labels";

/** Payment receipt. RLS guarantees parents only get receipts for their own children. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user || !user.profile.is_active) return NextResponse.json({ error: "Tizimga kiring" }, { status: 401 });
  const supabase = await createClient();
  const [{ data: p }, { data: s }] = await Promise.all([
    supabase.from("payments").select("amount, method, paid_on, receipt_number, is_void, created_at, children(full_name, kg_groups(name)), invoices(period, amount_due, paid_total, balance)").eq("id", id).maybeSingle(),
    supabase.from("settings").select("kindergarten_name, address, phone").eq("id", 1).single(),
  ]);
  if (!p) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  const child = p.children as unknown as { full_name: string; kg_groups: { name: string } | null };
  const inv = p.invoices as unknown as { period: string; amount_due: number; paid_total: number; balance: number };

  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const w = doc.internal.pageSize.getWidth();
  let y = 44;
  doc.setFont("helvetica", "bold").setFontSize(15).text(pdfText(s?.kindergarten_name ?? "Bog'cha"), w / 2, y, { align: "center" });
  y += 16;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
  doc.text(pdfText([s?.address, s?.phone].filter(Boolean).join(" · ")), w / 2, y, { align: "center" });
  y += 30;
  doc.setTextColor(20).setFont("helvetica", "bold").setFontSize(13).text(pdfText(`TO'LOV KVITANSIYASI № ${p.receipt_number}`), w / 2, y, { align: "center" });
  y += 30;
  const line = (label: string, value: string) => {
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(110).text(pdfText(label), 40, y);
    doc.setTextColor(20).setFont("helvetica", "bold").text(pdfText(value), w - 40, y, { align: "right" });
    y += 22;
  };
  line("Bola:", child.full_name);
  line("Guruh:", child.kg_groups?.name ?? "-");
  line("To'lov oyi:", formatMonth(inv.period));
  line("To'lov sanasi:", formatDate(p.paid_on));
  line("To'lov usuli:", PAYMENT_METHOD[p.method]);
  doc.setDrawColor(220).line(40, y - 8, w - 40, y - 8);
  y += 6;
  doc.setFontSize(12);
  line("To'langan summa:", formatSom(p.amount));
  line("Oy uchun hisoblangan:", formatSom(inv.amount_due));
  line("Oy bo'yicha qoldiq:", formatSom(Math.max(0, inv.balance)));
  if (p.is_void) {
    y += 10;
    doc.setTextColor(200, 0, 0).setFont("helvetica", "bold").setFontSize(14).text("BEKOR QILINGAN", w / 2, y, { align: "center" });
  }
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(130);
  doc.text(pdfText(`Kiritilgan: ${formatDateTime(p.created_at)}. To'lov bog'cha xodimi tomonidan qo'lda qayd etilgan.`), w / 2, doc.internal.pageSize.getHeight() - 30, { align: "center" });

  return new NextResponse(new Uint8Array(doc.output("arraybuffer")), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="kvitansiya-${p.receipt_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
