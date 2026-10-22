"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchPending, anyChannelConfigured } from "@/lib/integrations/dispatch";
import { smsConfigured } from "@/lib/integrations/sms";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { authorize, isUser, dbErrorMessage, fieldErrors, type ActionState } from "@/lib/actions";
import { FINANCE_ROLES, ADMIN_ROLES } from "@/lib/auth";
import { zDate, zMoney, zOptText, zText, zUuid } from "@/lib/validation";
import { addMonthsISO, currentMonthISO, formatSom, todayISO } from "@/lib/format";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Oyni tanlang").transform((m) => `${m}-01`);

function revalidateFinance() {
  revalidatePath("/tolovlar", "layout");
  revalidatePath("/tolovlar-tarixi");
  revalidatePath("/panel");
}

export async function generateInvoices(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(FINANCE_ROLES);
  if (!isUser(user)) return user;
  const month = monthSchema.safeParse(fd.get("month"));
  if (!month.success) return { ok: false, message: "Oyni tanlang" };
  if (month.data > addMonthsISO(currentMonthISO(), 12)) return { ok: false, message: "Juda uzoq kelajak oyi" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_monthly_invoices", { p_period: month.data });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateFinance();
  return { ok: true, message: data ? `${data} ta yangi hisob yaratildi` : "Barcha faol bolalar uchun hisoblar allaqachon mavjud" };
}

const paymentSchema = z.object({
  child_id: zUuid("Bola"),
  month: monthSchema,
  amount: zMoney("Summa").refine((v) => v > 0, "Summa 0 dan katta bo'lsin"),
  method: z.enum(["cash", "bank_transfer", "card", "other"], { error: "To'lov usulini tanlang" }),
  paid_on: zDate("To'lov sanasi").refine((d) => d <= todayISO(), "Sana kelajakda bo'lmasin"),
  receipt_number: z.string().trim().max(40, "40 belgidan oshmasin").optional().transform((v) => v || undefined),
  note: zOptText(500),
  client_token: z.string().uuid(),
  confirm_duplicate: z.string().optional(),
});

export async function recordPayment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(FINANCE_ROLES);
  if (!isUser(user)) return user;
  const parsed = paymentSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fieldErrors(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();

  // Creates the invoice when paying for a future month (advance payment).
  const { data: invoiceId, error: invErr } = await supabase.rpc("ensure_invoice", { p_child_id: v.child_id, p_period: v.month });
  if (invErr) return { ok: false, message: dbErrorMessage(invErr) };

  if (!v.confirm_duplicate) {
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: dup } = await supabase.from("payments").select("id, receipt_number")
      .eq("invoice_id", invoiceId).eq("amount", v.amount).eq("paid_on", v.paid_on).eq("is_void", false).gte("created_at", since).limit(1);
    if (dup?.length) {
      return {
        ok: false,
        message: `Xuddi shunday to'lov (${formatSom(v.amount)}) yaqinda kiritilgan: ${dup[0].receipt_number}. Agar bu boshqa to'lov bo'lsa, tasdiqlab qayta saqlang.`,
        data: { duplicate: true },
      };
    }
  }

  const { data, error } = await supabase.from("payments").insert({
    invoice_id: invoiceId, child_id: v.child_id, amount: v.amount, method: v.method, paid_on: v.paid_on,
    note: v.note, client_token: v.client_token, recorded_by: user.id, ...(v.receipt_number ? { receipt_number: v.receipt_number } : {}),
  }).select("id, receipt_number").single();
  if (error) {
    if (error.code === "23505" && error.message.includes("client_token")) return { ok: true, message: "To'lov allaqachon saqlangan" };
    if (error.code === "23505") return { ok: false, message: "Bu kvitansiya raqami allaqachon ishlatilgan", errors: { receipt_number: ["Raqam band"] } };
    return { ok: false, message: dbErrorMessage(error) };
  }
  revalidateFinance();
  revalidatePath(`/bolalar/${v.child_id}`);
  if (anyChannelConfigured()) after(() => dispatchPending().then(() => undefined));
  return { ok: true, message: `To'lov saqlandi. Kvitansiya: ${data.receipt_number}`, data: { paymentId: data.id } };
}

export async function voidPayment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(FINANCE_ROLES);
  if (!isUser(user)) return user;
  const p = z.object({ id: zUuid(), reason: zText("Sabab", 5, 500) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return fieldErrors(p.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_payment", { p_payment_id: p.data.id, p_reason: p.data.reason });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateFinance();
  return { ok: true, message: "To'lov bekor qilindi. Yozuv audit jurnalida saqlandi." };
}

export async function addAdjustment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES, "finance.adjust");
  if (!isUser(user)) return user;
  const p = z.object({
    invoice_id: zUuid(),
    kind: z.enum(["discount", "surcharge", "correction"]),
    amount: z.string().transform((v) => v.replace(/[\s,']/g, "")).refine((v) => /^-?\d{1,12}$/.test(v) && Number(v) !== 0, "Summani kiriting").transform(Number),
    reason: zText("Sabab", 5, 500),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return fieldErrors(p.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_invoice_adjustment", { p_invoice_id: p.data.invoice_id, p_kind: p.data.kind, p_amount: p.data.amount, p_reason: p.data.reason });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateFinance();
  return { ok: true, message: "Hisob o'zgartirildi" };
}

export async function updateInvoiceBase(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(ADMIN_ROLES);
  if (!isUser(user)) return user;
  const p = z.object({ invoice_id: zUuid(), amount: zMoney("Summa"), reason: zText("Sabab", 5, 500) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return fieldErrors(p.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_invoice_base", { p_invoice_id: p.data.invoice_id, p_amount: p.data.amount, p_reason: p.data.reason });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateFinance();
  return { ok: true, message: "Asosiy summa yangilandi" };
}

/** Queues a debt reminder for each family with overdue invoices (Telegram if chat ID known, else SMS). */
export async function sendDebtReminders(): Promise<ActionState> {
  const user = await authorize(FINANCE_ROLES);
  if (!isUser(user)) return user;
  if (!anyChannelConfigured()) {
    return { ok: false, message: "Telegram yoki SMS sozlanmagan. Avval Sozlamalar > Integratsiyalar bo'limini ko'ring." };
  }
  const supabase = await createClient();
  const { data } = await supabase.from("invoices")
    .select("balance, children!inner(id, full_name, child_guardians(is_primary, guardians(phone, telegram_chat_id)))")
    .gt("balance", 0).lt("due_date", todayISO());
  type R = { balance: number; children: { id: string; full_name: string; child_guardians: { is_primary: boolean; guardians: { phone: string; telegram_chat_id: string | null } | null }[] } };
  const byChild = new Map<string, { name: string; debt: number; phone?: string; chat?: string | null }>();
  for (const r of (data ?? []) as unknown as R[]) {
    const g = (r.children.child_guardians.find((x) => x.is_primary) ?? r.children.child_guardians[0])?.guardians;
    const e = byChild.get(r.children.id) ?? { name: r.children.full_name, debt: 0, phone: g?.phone, chat: g?.telegram_chat_id };
    e.debt += Number(r.balance);
    byChild.set(r.children.id, e);
  }
  const { data: s } = await supabase.from("settings").select("kindergarten_name, phone").eq("id", 1).single();
  const rows = [...byChild.entries()].flatMap(([id, e]) => {
    const body = `${s?.kindergarten_name ?? "Bog'cha"}: ${e.name} uchun to'lov muddati o'tgan. Qarz: ${formatSom(e.debt)}.${s?.phone ? ` Tel: ${s.phone}` : ""}`;
    if (e.chat && process.env.TELEGRAM_BOT_TOKEN) return [{ channel: "telegram", recipient: e.chat, body, related_entity: "debt_reminder", related_id: id }];
    if (e.phone && smsConfigured()) return [{ channel: "sms", recipient: e.phone, body, related_entity: "debt_reminder", related_id: id }];
    return [];
  });
  if (!rows.length) return { ok: false, message: "Eslatma yuboriladigan qarzdor topilmadi (yoki aloqa kanali yo'q)" };
  const { error } = await createAdminClient().from("outbound_messages").insert(rows);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  after(() => dispatchPending(200).then(() => undefined));
  return { ok: true, message: `${rows.length} ta eslatma yuborish navbatiga qo'yildi` };
}
