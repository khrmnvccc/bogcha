"use client";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Input } from "@/components/ui/input";
import { updateMyContact } from "./actions";
import { useI18n } from "@/lib/i18n/client";

export function ContactForm({ v, isParent }: { v: { phone?: string | null; phone2?: string | null; address?: string | null; workplace?: string | null }; isParent: boolean }) {
  const { t } = useI18n();
  return (
    <ActionForm action={updateMyContact} className="grid gap-4 sm:grid-cols-2">
      <Field name="phone" label={t("Telefon")} required><Input type="tel" inputMode="tel" defaultValue={v.phone ?? ""} /></Field>
      {isParent && <>
        <Field name="phone2" label={t("Qo'shimcha telefon")}><Input type="tel" inputMode="tel" defaultValue={v.phone2 ?? ""} /></Field>
        <Field name="address" label={t("Manzil")} className="sm:col-span-2"><Input defaultValue={v.address ?? ""} /></Field>
        <Field name="workplace" label={t("Ish joyi")} className="sm:col-span-2"><Input defaultValue={v.workplace ?? ""} /></Field>
      </>}
      <div className="sm:col-span-2"><SubmitButton>{t("Saqlash")}</SubmitButton></div>
    </ActionForm>
  );
}
