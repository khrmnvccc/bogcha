"use client";
import { FilePlus2, Percent, Ban, Pencil, BellRing } from "lucide-react";
import { FormDialog, ConfirmAction } from "@/components/ui/dialog";
import { Field } from "@/components/ui/action-form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { formatMonth } from "@/lib/format";
import { generateInvoices, addAdjustment, voidPayment, updateInvoiceBase, sendDebtReminders } from "./actions";
import { useI18n } from "@/lib/i18n/client";

export function GenerateInvoices({ month }: { month: string }) {
  const { t, f } = useI18n();
  return (
    <ConfirmAction
      trigger={<Button variant="outline"><FilePlus2 className="h-4 w-4" />{" "}{t("Hisoblarni yaratish")}</Button>}
      title={t("{0} uchun hisoblar yaratilsinmi?", [f.formatMonth(`${month}-01`)])}
      description={t("Hisobi yo'q har bir faol bola uchun oylik hisob yaratiladi. Mavjud hisoblar o'zgarmaydi. Ota-onalarga bildirishnoma yuboriladi.")}
      action={generateInvoices} hidden={{ month }} danger={false} confirmText={t("Yaratish")}
    />
  );
}

export function AdjustmentDialog({ invoiceId }: { invoiceId: string }) {
  const { t } = useI18n();
  return (
    <FormDialog title={t("Chegirma yoki tuzatish")} description={t("Sabab va kim tasdiqlagani saqlanadi, ota-ona ham sababni ko'radi.")} action={addAdjustment} hidden={{ invoice_id: invoiceId }}
      trigger={<Button variant="outline" size="sm"><Percent className="h-4 w-4" />{" "}{t("Chegirma")}</Button>}>
      <Field name="kind" label={t("Turi")} required>
        <Select defaultValue="discount">
          <option value="discount">{t("Chegirma (summa kamayadi)")}</option>
          <option value="surcharge">{t("Qo'shimcha to'lov (summa oshadi)")}</option>
          <option value="correction">{t("Tuzatish (+ yoki −)")}</option>
        </Select>
      </Field>
      <Field name="amount" label={t("Summa (so'm)")} required hint={t("Tuzatish uchun kamaytirishda minus belgisi qo'ying: -50000")}>
        <Input inputMode="numeric" />
      </Field>
      <Field name="reason" label={t("Sabab")} required><Textarea rows={2} placeholder={t("Masalan: ikkinchi farzand uchun 10% chegirma")} /></Field>
    </FormDialog>
  );
}

export function BaseAmountDialog({ invoiceId, current }: { invoiceId: string; current: number }) {
  const { t } = useI18n();
  return (
    <FormDialog title={t("Asosiy summani o'zgartirish")} action={updateInvoiceBase} hidden={{ invoice_id: invoiceId }}
      trigger={<Button variant="ghost" size="sm"><Pencil className="h-4 w-4" />{" "}{t("Summa")}</Button>}>
      <Notice tone="amber">{t("Odatda chegirma yoki tuzatishdan foydalanish tavsiya etiladi. Bu o'zgarish audit jurnaliga yoziladi.")}</Notice>
      <Field name="amount" label={t("Yangi asosiy summa (so'm)")} required><Input inputMode="numeric" defaultValue={String(current)} /></Field>
      <Field name="reason" label={t("Sabab")} required><Textarea rows={2} /></Field>
    </FormDialog>
  );
}

export function VoidPayment({ id, receipt }: { id: string; receipt: string }) {
  const { t } = useI18n();
  return (
    <ConfirmAction
      trigger={<Button variant="ghost" size="sm" aria-label={t("Bekor qilish")}><Ban className="h-4 w-4 text-red-500" /></Button>}
      title={t("{0} to'lovini bekor qilasizmi?", [receipt])}
      description={t("To'lov o'chirilmaydi: u bekor qilingan deb belgilanadi va qarzdorlik qayta hisoblanadi. Ota-onaga xabar boradi.")}
      action={voidPayment} hidden={{ id }} reasonLabel={t("Bekor qilish sababi")} confirmText={t("Bekor qilish")}
    />
  );
}

export function DebtReminders({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  return (
    <ConfirmAction
      trigger={<Button variant="outline" disabled={!enabled} title={enabled ? undefined : t("Telegram yoki SMS sozlanmagan")}><BellRing className="h-4 w-4" />{" "}{t("Eslatma yuborish")}</Button>}
      title={t("Qarzdorlarga eslatma yuborilsinmi?")}
      description={t("Muddati o'tgan qarzi bor oilalarga Telegram (chat ID bo'lsa) yoki SMS orqali eslatma yuboriladi.")}
      action={async () => sendDebtReminders()} hidden={{}} danger={false} confirmText={t("Yuborish")}
    />
  );
}
