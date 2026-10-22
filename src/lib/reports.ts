import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth";
import { ADMIN_ROLES, canViewFinance } from "@/lib/auth";
import type { Report } from "@/lib/export/types";
import { INVOICE_STATUS, PAYMENT_METHOD, CHILD_STATUS } from "@/lib/labels";
import { addMonthsISO, currentMonthISO, formatDate, formatMonth, formatTime, todayISO } from "@/lib/format";

export type ReportKey = "tolovlar" | "tolovlar-tarixi" | "qarzdorlar" | "bolalar-davomati" | "xodimlar-davomati" | "bolalar";

export const REPORTS: Record<ReportKey, { title: string; description: string; finance: boolean; admin: boolean }> = {
  "tolovlar": { title: "Oylik to'lovlar hisoboti", description: "Tanlangan oy bo'yicha har bir bolaning hisobi, to'lovi va qoldig'i", finance: true, admin: false },
  "tolovlar-tarixi": { title: "To'lovlar tarixi", description: "Sana oralig'ida qabul qilingan barcha to'lovlar", finance: true, admin: false },
  "qarzdorlar": { title: "Qarzdorlar ro'yxati", description: "To'lanmagan va qisman to'langan barcha hisoblar", finance: true, admin: false },
  "bolalar-davomati": { title: "Bolalar davomati (oylik)", description: "Har bir bola bo'yicha keldi/kelmadi kunlari", finance: false, admin: false },
  "xodimlar-davomati": { title: "Xodimlar davomati (oylik)", description: "Ish kunlari, soatlar, kechikishlar va chala yozuvlar", finance: false, admin: true },
  "bolalar": { title: "Bolalar ro'yxati", description: "Guruh, ota-ona va holat bo'yicha ro'yxat", finance: false, admin: true },
};

export function canRunReport(user: CurrentUser, key: ReportKey): boolean {
  const def = REPORTS[key];
  if (!def) return false;
  if (def.finance) return canViewFinance(user);
  if (def.admin) return ADMIN_ROLES.includes(user.profile.role);
  return ADMIN_ROLES.includes(user.profile.role) || user.profile.role === "teacher";
}

type Params = Record<string, string | undefined>;
const monthOf = (p: Params) => (p.oy && /^\d{4}-\d{2}$/.test(p.oy) ? `${p.oy}-01` : currentMonthISO());

export async function buildReport(supabase: SupabaseClient, key: ReportKey, p: Params): Promise<Report> {
  const { data: s } = await supabase.from("settings").select("kindergarten_name").eq("id", 1).single();
  const orgName = s?.kindergarten_name ?? "Bog'cha";
  const r = await builders[key](supabase, p);
  return { ...r, orgName };
}

const builders: Record<ReportKey, (sb: SupabaseClient, p: Params) => Promise<Report>> = {
  async "tolovlar"(sb, p) {
    const month = monthOf(p);
    let q = sb.from("invoices").select("period, amount_due, paid_total, balance, status, due_date, adjustments_total, children!inner(full_name, group_id, kg_groups(name))");
    if (p.holat === "qarz") q = q.gt("balance", 0).lte("period", currentMonthISO());
    else q = q.eq("period", month);
    if (p.holat && p.holat !== "qarz") q = q.eq("status", p.holat);
    if (p.guruh) q = q.eq("children.group_id", p.guruh);
    const { data } = await q.limit(5000);
    type R = { period: string; amount_due: number; paid_total: number; balance: number; status: string; due_date: string; adjustments_total: number; children: { full_name: string; kg_groups: { name: string } | null } };
    const rows = ((data ?? []) as unknown as R[]).sort((a, b) => a.children.full_name.localeCompare(b.children.full_name)).map((r, i) => ({
      n: i + 1, name: r.children.full_name, group: r.children.kg_groups?.name ?? "", period: formatMonth(r.period),
      due: Number(r.amount_due), adj: Number(r.adjustments_total), paid: Number(r.paid_total), balance: Number(r.balance),
      status: INVOICE_STATUS[r.status]?.label ?? r.status, due_date: formatDate(r.due_date),
    }));
    const sum = (k: string) => rows.reduce((a, r) => a + Number(r[k as keyof typeof r]), 0);
    return {
      title: "Oylik to'lovlar hisoboti", subtitle: p.holat === "qarz" ? "Barcha qarzdorliklar" : formatMonth(month), filename: `tolovlar-${month.slice(0, 7)}`, landscape: true,
      columns: [
        { header: "№", key: "n", width: 5, type: "number" }, { header: "Bola", key: "name", width: 30 }, { header: "Guruh", key: "group", width: 16 },
        { header: "Oy", key: "period", width: 14 }, { header: "Hisoblangan", key: "due", type: "money" }, { header: "Tuzatish", key: "adj", type: "money" },
        { header: "To'langan", key: "paid", type: "money" }, { header: "Qoldiq", key: "balance", type: "money" },
        { header: "Holat", key: "status", width: 16 }, { header: "Muddat", key: "due_date", width: 12 },
      ],
      rows,
      totals: { name: "Jami", due: sum("due"), adj: sum("adj"), paid: sum("paid"), balance: sum("balance") },
    };
  },

  async "tolovlar-tarixi"(sb, p) {
    const from = p.dan ?? currentMonthISO();
    const to = p.gacha ?? todayISO();
    let q = sb.from("payments").select("paid_on, amount, method, receipt_number, note, children!inner(full_name, group_id, kg_groups(name)), invoices(period), recorder:recorded_by(full_name)")
      .eq("is_void", false).gte("paid_on", from).lte("paid_on", to).order("paid_on");
    if (p.usul) q = q.eq("method", p.usul);
    if (p.guruh) q = q.eq("children.group_id", p.guruh);
    const { data } = await q.limit(10000);
    type R = { paid_on: string; amount: number; method: string; receipt_number: string; note: string | null; children: { full_name: string; kg_groups: { name: string } | null }; invoices: { period: string } | null; recorder: { full_name: string } | null };
    const rows = ((data ?? []) as unknown as R[]).map((r, i) => ({
      n: i + 1, date: formatDate(r.paid_on), name: r.children.full_name, group: r.children.kg_groups?.name ?? "", period: formatMonth(r.invoices?.period),
      method: PAYMENT_METHOD[r.method], receipt: r.receipt_number, amount: Number(r.amount), by: r.recorder?.full_name ?? "", note: r.note ?? "",
    }));
    return {
      title: "To'lovlar tarixi", subtitle: `${formatDate(from)} - ${formatDate(to)}`, filename: `tolovlar-tarixi-${from}-${to}`, landscape: true,
      columns: [
        { header: "№", key: "n", width: 5, type: "number" }, { header: "Sana", key: "date", width: 12 }, { header: "Bola", key: "name", width: 28 },
        { header: "Guruh", key: "group", width: 14 }, { header: "Oy", key: "period", width: 14 }, { header: "Usul", key: "method", width: 16 },
        { header: "Kvitansiya", key: "receipt", width: 14 }, { header: "Summa", key: "amount", type: "money" }, { header: "Kiritgan", key: "by", width: 20 },
        { header: "Izoh", key: "note", width: 24 },
      ],
      rows, totals: { name: "Jami", amount: rows.reduce((a, r) => a + r.amount, 0) },
    };
  },

  async "qarzdorlar"(sb, p) {
    let q = sb.from("invoices").select("period, balance, due_date, children!inner(id, full_name, group_id, kg_groups(name), child_guardians(is_primary, guardians(full_name, phone)))")
      .gt("balance", 0).lte("period", currentMonthISO());
    if (p.guruh) q = q.eq("children.group_id", p.guruh);
    const { data } = await q.limit(10000);
    type R = { period: string; balance: number; due_date: string; children: { id: string; full_name: string; kg_groups: { name: string } | null; child_guardians: { is_primary: boolean; guardians: { full_name: string; phone: string } | null }[] } };
    const today = todayISO();
    const byChild = new Map<string, { name: string; group: string; guardian: string; phone: string; months: string[]; debt: number; overdue: number }>();
    for (const r of (data ?? []) as unknown as R[]) {
      const g = (r.children.child_guardians.find((x) => x.is_primary) ?? r.children.child_guardians[0])?.guardians;
      const e = byChild.get(r.children.id) ?? { name: r.children.full_name, group: r.children.kg_groups?.name ?? "", guardian: g?.full_name ?? "", phone: g?.phone ?? "", months: [], debt: 0, overdue: 0 };
      e.months.push(formatMonth(r.period));
      e.debt += Number(r.balance);
      if (r.due_date < today) e.overdue += Number(r.balance);
      byChild.set(r.children.id, e);
    }
    const rows = [...byChild.values()].sort((a, b) => b.debt - a.debt).map((e, i) => ({ n: i + 1, ...e, months: e.months.join(", ") }));
    return {
      title: "Qarzdorlar ro'yxati", subtitle: `Holat: ${formatDate(today)}`, filename: `qarzdorlar-${today}`, landscape: true,
      columns: [
        { header: "№", key: "n", width: 5, type: "number" }, { header: "Bola", key: "name", width: 28 }, { header: "Guruh", key: "group", width: 14 },
        { header: "Ota-ona", key: "guardian", width: 24 }, { header: "Telefon", key: "phone", width: 18 }, { header: "Oylar", key: "months", width: 30 },
        { header: "Qarz", key: "debt", type: "money" }, { header: "Muddati o'tgan", key: "overdue", type: "money" },
      ],
      rows, totals: { name: "Jami", debt: rows.reduce((a, r) => a + r.debt, 0), overdue: rows.reduce((a, r) => a + r.overdue, 0) },
    };
  },

  async "bolalar-davomati"(sb, p) {
    const month = monthOf(p);
    const end = addMonthsISO(month, 1);
    let cq = sb.from("children").select("id, full_name, kg_groups(name)").in("status", ["active", "paused"]).order("full_name");
    if (p.guruh) cq = cq.eq("group_id", p.guruh);
    const { data: kids } = await cq;
    const ids = (kids ?? []).map((k) => k.id);
    const { data: att } = ids.length ? await sb.from("child_attendance").select("child_id, status").gte("date", month).lt("date", end).in("child_id", ids).limit(50000) : { data: [] };
    const agg = new Map<string, Record<string, number>>();
    for (const a of att ?? []) {
      const m = agg.get(a.child_id) ?? { present: 0, late: 0, absent: 0, excused: 0 };
      m[a.status] += 1;
      agg.set(a.child_id, m);
    }
    const rows = ((kids ?? []) as unknown as { id: string; full_name: string; kg_groups: { name: string } | null }[]).map((k, i) => {
      const m = agg.get(k.id) ?? { present: 0, late: 0, absent: 0, excused: 0 };
      const total = m.present + m.late + m.absent + m.excused;
      return { n: i + 1, name: k.full_name, group: k.kg_groups?.name ?? "", present: m.present, late: m.late, absent: m.absent, excused: m.excused, total, rate: total ? Math.round(((m.present + m.late) / total) * 100) : 0 };
    });
    return {
      title: "Bolalar davomati", subtitle: formatMonth(month), filename: `bolalar-davomati-${month.slice(0, 7)}`,
      columns: [
        { header: "№", key: "n", width: 5, type: "number" }, { header: "Bola", key: "name", width: 30 }, { header: "Guruh", key: "group", width: 16 },
        { header: "Keldi", key: "present", type: "number", width: 9 }, { header: "Kechikdi", key: "late", type: "number", width: 10 },
        { header: "Kelmagan", key: "absent", type: "number", width: 10 }, { header: "Sababli", key: "excused", type: "number", width: 10 },
        { header: "Belgilangan kun", key: "total", type: "number", width: 12 }, { header: "Qatnashish", key: "rate", type: "percent", width: 12 },
      ],
      rows,
    };
  },

  async "xodimlar-davomati"(sb, p) {
    const month = monthOf(p);
    const end = addMonthsISO(month, 1);
    const today = todayISO();
    const [{ data: emps }, { data: att }] = await Promise.all([
      sb.from("employees").select("id, full_name, position").neq("status", "terminated").order("full_name"),
      sb.from("employee_attendance").select("employee_id, work_date, check_in_at, check_out_at, worked_minutes, late_minutes, early_leave_minutes, is_corrected").gte("work_date", month).lt("work_date", end).limit(20000),
    ]);
    const rows = (emps ?? []).map((e, i) => {
      const recs = (att ?? []).filter((a) => a.employee_id === e.id);
      const minutes = recs.reduce((s, r) => s + (r.worked_minutes ?? 0), 0);
      return {
        n: i + 1, name: e.full_name, position: e.position, days: recs.length,
        hours: Math.round((minutes / 60) * 10) / 10,
        late: recs.filter((r) => r.late_minutes > 0).length,
        late_min: recs.reduce((s, r) => s + r.late_minutes, 0),
        early: recs.filter((r) => r.early_leave_minutes > 0).length,
        missing: recs.filter((r) => !r.check_out_at && r.work_date < today).length,
        corrected: recs.filter((r) => r.is_corrected).length,
        first: recs.length ? formatTime(recs.map((r) => r.check_in_at).sort()[0]) : "",
      };
    });
    return {
      title: "Xodimlar davomati", subtitle: formatMonth(month), filename: `xodimlar-davomati-${month.slice(0, 7)}`, landscape: true,
      columns: [
        { header: "№", key: "n", width: 5, type: "number" }, { header: "Xodim", key: "name", width: 28 }, { header: "Lavozim", key: "position", width: 18 },
        { header: "Ish kunlari", key: "days", type: "number", width: 10 }, { header: "Soatlar", key: "hours", type: "number", width: 10 },
        { header: "Kechikish (marta)", key: "late", type: "number", width: 12 }, { header: "Kechikish (daq)", key: "late_min", type: "number", width: 12 },
        { header: "Erta ketish", key: "early", type: "number", width: 10 }, { header: "Ketish belgilanmagan", key: "missing", type: "number", width: 14 },
        { header: "Tuzatilgan", key: "corrected", type: "number", width: 10 },
      ],
      rows,
    };
  },

  async "bolalar"(sb, p) {
    let q = sb.from("children").select("full_name, birth_date, enrollment_date, status, kg_groups(name), child_guardians(is_primary, relationship, guardians(full_name, phone))").order("full_name");
    if (p.guruh) q = q.eq("group_id", p.guruh);
    if (p.holat) q = q.eq("status", p.holat);
    const { data } = await q.limit(5000);
    type R = { full_name: string; birth_date: string; enrollment_date: string; status: string; kg_groups: { name: string } | null; child_guardians: { is_primary: boolean; relationship: string; guardians: { full_name: string; phone: string } | null }[] };
    const rows = ((data ?? []) as unknown as R[]).map((c, i) => {
      const g = c.child_guardians.find((x) => x.is_primary) ?? c.child_guardians[0];
      return {
        n: i + 1, name: c.full_name, birth: formatDate(c.birth_date), group: c.kg_groups?.name ?? "", enrolled: formatDate(c.enrollment_date),
        status: CHILD_STATUS[c.status]?.label ?? c.status, guardian: g?.guardians ? `${g.guardians.full_name} (${g.relationship})` : "", phone: g?.guardians?.phone ?? "",
      };
    });
    return {
      title: "Bolalar ro'yxati", filename: `bolalar-${todayISO()}`, landscape: true,
      columns: [
        { header: "№", key: "n", width: 5, type: "number" }, { header: "Bola", key: "name", width: 28 }, { header: "Tug'ilgan", key: "birth", width: 12 },
        { header: "Guruh", key: "group", width: 14 }, { header: "Qabul", key: "enrolled", width: 12 }, { header: "Holat", key: "status", width: 12 },
        { header: "Ota-ona", key: "guardian", width: 30 }, { header: "Telefon", key: "phone", width: 18 },
      ],
      rows,
    };
  },
};
