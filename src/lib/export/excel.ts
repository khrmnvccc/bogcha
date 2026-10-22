import "server-only";
import ExcelJS from "exceljs";
import type { Report } from "./types";
import { formatDateTime } from "@/lib/format";

export async function toXlsx(r: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = r.orgName ?? "Bog'cha";
  wb.created = new Date();
  const ws = wb.addWorksheet(r.title.slice(0, 31).replace(/[\\/?*[\]:]/g, " "), {
    pageSetup: { orientation: r.landscape ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  const ncol = r.columns.length;
  ws.mergeCells(1, 1, 1, ncol);
  ws.getCell(1, 1).value = `${r.orgName ? r.orgName + " — " : ""}${r.title}`;
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.mergeCells(2, 1, 2, ncol);
  ws.getCell(2, 1).value = `${r.subtitle ? r.subtitle + " · " : ""}Tayyorlandi: ${formatDateTime(new Date())}`;
  ws.getCell(2, 1).font = { size: 10, color: { argb: "FF64748B" } };

  const header = ws.getRow(4);
  r.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    ws.getColumn(i + 1).width = c.width ?? (c.type === "money" ? 16 : 20);
    if (c.type === "money" || c.type === "number") ws.getColumn(i + 1).numFmt = "#,##0";
    if (c.type === "percent") ws.getColumn(i + 1).numFmt = "0%";
  });
  header.height = 22;

  r.rows.forEach((row, idx) => {
    const xr = ws.getRow(5 + idx);
    r.columns.forEach((c, i) => {
      const v = row[c.key];
      xr.getCell(i + 1).value = c.type === "percent" && typeof v === "number" ? v / 100 : (v ?? "");
    });
    if (idx % 2 === 1) xr.eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }));
  });

  if (r.totals) {
    const tr = ws.getRow(5 + r.rows.length);
    r.columns.forEach((c, i) => {
      const v = r.totals![c.key];
      tr.getCell(i + 1).value = c.type === "percent" && typeof v === "number" ? v / 100 : (v ?? "");
      tr.getCell(i + 1).font = { bold: true };
      tr.getCell(i + 1).border = { top: { style: "thin" } };
    });
  }
  ws.views = [{ state: "frozen", ySplit: 4 }];
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + r.rows.length, column: ncol } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
