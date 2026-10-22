import "server-only";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Report } from "./types";
import { formatDateTime, formatNumber } from "@/lib/format";

/** Built-in PDF fonts are WinAnsi: normalise characters they cannot draw. */
export function pdfText(s: unknown): string {
  return String(s ?? "")
    .replace(/[‘’ʻʼ`]/g, "'")
    .replace(/−/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E -ÿ\n·]/g, "");
}

function cell(v: unknown, type?: string): string {
  if (v == null || v === "") return "";
  if (type === "money" || type === "number") return formatNumber(Number(v));
  if (type === "percent") return `${v}%`;
  return pdfText(v);
}

export function toPdf(r: Report): Buffer {
  const doc = new jsPDF({ orientation: r.landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(pdfText(r.title), 40, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(pdfText(`${r.orgName ?? ""}${r.subtitle ? "  ·  " + r.subtitle : ""}`), 40, 64);
  doc.text(pdfText(`Tayyorlandi: ${formatDateTime(new Date())}`), w - 40, 64, { align: "right" });

  const numeric = (t?: string) => t === "money" || t === "number" || t === "percent";
  autoTable(doc, {
    startY: 78,
    head: [r.columns.map((c) => pdfText(c.header))],
    body: r.rows.map((row) => r.columns.map((c) => cell(row[c.key], c.type))),
    foot: r.totals ? [r.columns.map((c) => cell(r.totals![c.key], c.type))] : undefined,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: Object.fromEntries(r.columns.map((c, i) => [i, numeric(c.type) ? { halign: "right" as const } : {}])),
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`${doc.getNumberOfPages()}`, w - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" });
    },
  });
  return Buffer.from(doc.output("arraybuffer"));
}
