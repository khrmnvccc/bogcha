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
import { tr } from "@/lib/i18n/server";

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
  return { ok: true, message: data ? await tr("{0} ta yangi hisob yaratildi", [data]) : "Barcha faol bolalar uchun hisoblar allaqachon mavjud" };
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
        message: await tr("Xuddi shunday to'lov ({0}) yaqinda kiritilgan: {1}. Agar bu boshqa to'lov bo'lsa, tasdiqlab qayta saqlang.", [formatSom(v.amount), dup[0].receipt_number]),
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
  return { ok: true, message: await tr("To'lov saqlandi. Kvitansiya: {0}", [data.receipt_number]), data: { paymentId: data.id } };
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

/**
 * Sends a debt reminder to every family with overdue invoices: an in-app
 * notification for each guardian account (which also goes to Telegram when
 * linked), plus an SMS to the primary guardian who has no Telegram, if SMS is set up.
 */
export async function sendDebtReminders(): Promise<ActionState> {
  const user = await authorize(FINANCE_ROLES);
  if (!isUser(user)) return user;
  const supabase = await createClient();
  const { data } = await supabase.from("invoices")
    .select("balance, children!inner(id, full_name, child_guardians(is_primary, guardians(phone, telegram_chat_id, profile_id, profiles(telegram_chat_id, is_active))))")
    .gt("balance", 0).lt("due_date", todayISO());
  type G = { phone: string; telegram_chat_id: string | null; profile_id: string | null; profiles: { telegram_chat_id: string | null; is_active: boolean } | null };
  type R = { balance: number; children: { id: string; full_name: string; child_guardians: { is_primary: boolean; guardians: G | null }[] } };
  const byChild = new Map<string, { name: string; debt: number; guardians: { primary: boolean; g: G }[] }>();
  for (const r of (data ?? []) as unknown as R[]) {
    const e = byChild.get(r.children.id) ?? {
      name: r.children.full_name, debt: 0,
      guardians: r.children.child_guardians.filter((x) => x.guardians).map((x) => ({ primary: x.is_primary, g: x.guardians as G })),
    };
    e.debt += Number(r.balance);
    byChild.set(r.children.id, e);
  }
  const { data: s } = await supabase.from("settings").select("kindergarten_name, phone").eq("id", 1).single();
  const notifications: { user_id: string; kind: string; title: string; body: string; link: string }[] = [];
  const sms: { channel: string; recipient: string; body: string; related_entity: string; related_id: string }[] = [];
  for (const [id, e] of byChild) {
    const body = `${e.name} uchun to'lov muddati o'tgan. Qarzdorlik: ${formatSom(e.debt)}. To'lovni bog'cha kassasida amalga oshirishingiz mumkin.${s?.phone ? ` Tel: ${s.phone}` : ""}`;
    for (const { g } of e.guardians) {
      if (g.profile_id && g.profiles?.is_active) {
        notifications.push({ user_id: g.profile_id, kind: "reminder", title: "⚠️ To'lov eslatmasi", body, link: "/ota-ona/tolovlar" });
      }
    }
    const primary = (e.guardians.find((x) => x.primary) ?? e.guardians[0])?.g;
    const hasTelegram = e.guardians.some(({ g }) => g.telegram_chat_id || g.profiles?.telegram_chat_id);
    if (primary?.phone && !hasTelegram && smsConfigured()) {
      sms.push({ channel: "sms", recipient: primary.phone, body: `${s?.kindergarten_name ?? "Bog'cha"}: ${body}`, related_entity: "debt_reminder", related_id: id });
    }
  }
  if (!notifications.length && !sms.length) return { ok: false, message: "Eslatma yuboriladigan qarzdor topilmadi (yoki ota-onaning hisobi yo'q)" };
  const admin = createAdminClient();
  if (notifications.length) {
    const { error } = await admin.from("notifications").insert(notifications);
    if (error) return { ok: false, message: dbErrorMessage(error) };
  }
  if (sms.length) {
    const { error } = await admin.from("outbound_messages").insert(sms);
    if (error) return { ok: false, message: dbErrorMessage(error) };
  }
  if (anyChannelConfigured()) after(() => dispatchPending(200).then(() => undefined));
  return { ok: true, message: await tr("{0} ta oilaga eslatma yuborildi", [byChild.size]) };
}
