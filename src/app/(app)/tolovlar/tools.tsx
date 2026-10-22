"use client";
import { FilePlus2, Percent, Ban, Pencil, BellRing } from "lucide-react";
import { FormDialog, ConfirmAction } from "@/components/ui/dialog";
import { Field } from "@/components/ui/action-form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { formatMonth } from "@/lib/format";
import { generateInvoices, addAdjustment, voidPayment, updateInvoiceBase, sendDebtReminders } from "./actions";

export function GenerateInvoices({ month }: { month: string }) {
  return (
    <ConfirmAction
      trigger={<Button variant="outline"><FilePlus2 className="h-4 w-4" /> Hisoblarni yaratish</Button>}
      title={`${formatMonth(`${month}-01`)} uchun hisoblar yaratilsinmi?`}
      description="Hisobi yo'q har bir faol bola uchun oylik hisob yaratiladi. Mavjud hisoblar o'zgarmaydi. Ota-onalarga bildirishnoma yuboriladi."
      action={generateInvoices} hidden={{ month }} danger={false} confirmText="Yaratish"
    />
  );
}

export function AdjustmentDialog({ invoiceId }: { invoiceId: string }) {
  return (
    <FormDialog title="Chegirma yoki tuzatish" description="Sabab va kim tasdiqlagani saqlanadi, ota-ona ham sababni ko'radi." action={addAdjustment} hidden={{ invoice_id: invoiceId }}
      trigger={<Button variant="outline" size="sm"><Percent className="h-4 w-4" /> Chegirma</Button>}>
      <Field name="kind" label="Turi" required>
        <Select defaultValue="discount">
          <option value="discount">Chegirma (summa kamayadi)</option>
          <option value="surcharge">Qo&apos;shimcha to&apos;lov (summa oshadi)</option>
          <option value="correction">Tuzatish (+ yoki −)</option>
        </Select>
      </Field>
      <Field name="amount" label="Summa (so'm)" required hint="Tuzatish uchun kamaytirishda minus belgisi qo'ying: -50000">
        <Input inputMode="numeric" />
      </Field>
      <Field name="reason" label="Sabab" required><Textarea rows={2} placeholder="Masalan: ikkinchi farzand uchun 10% chegirma" /></Field>
    </FormDialog>
  );
}

export function BaseAmountDialog({ invoiceId, current }: { invoiceId: string; current: number }) {
  return (
    <FormDialog title="Asosiy summani o'zgartirish" action={updateInvoiceBase} hidden={{ invoice_id: invoiceId }}
      trigger={<Button variant="ghost" size="sm"><Pencil className="h-4 w-4" /> Summa</Button>}>
      <Notice tone="amber">Odatda chegirma yoki tuzatishdan foydalanish tavsiya etiladi. Bu o&apos;zgarish audit jurnaliga yoziladi.</Notice>
      <Field name="amount" label="Yangi asosiy summa (so'm)" required><Input inputMode="numeric" defaultValue={String(current)} /></Field>
      <Field name="reason" label="Sabab" required><Textarea rows={2} /></Field>
    </FormDialog>
  );
}

export function VoidPayment({ id, receipt }: { id: string; receipt: string }) {
  return (
    <ConfirmAction
      trigger={<Button variant="ghost" size="sm" aria-label="Bekor qilish"><Ban className="h-4 w-4 text-red-500" /></Button>}
      title={`${receipt} to'lovini bekor qilasizmi?`}
      description="To'lov o'chirilmaydi: u bekor qilingan deb belgilanadi va qarzdorlik qayta hisoblanadi. Ota-onaga xabar boradi."
      action={voidPayment} hidden={{ id }} reasonLabel="Bekor qilish sababi" confirmText="Bekor qilish"
    />
  );
}

export function DebtReminders({ enabled }: { enabled: boolean }) {
  return (
    <ConfirmAction
      trigger={<Button variant="outline" disabled={!enabled} title={enabled ? undefined : "Telegram yoki SMS sozlanmagan"}><BellRing className="h-4 w-4" /> Eslatma yuborish</Button>}
      title="Qarzdorlarga eslatma yuborilsinmi?"
      description="Muddati o'tgan qarzi bor oilalarga Telegram (chat ID bo'lsa) yoki SMS orqali eslatma yuboriladi."
      action={async () => sendDebtReminders()} hidden={{}} danger={false} confirmText="Yuborish"
    />
  );
}
