"use client";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Input } from "@/components/ui/input";
import { updateMyContact } from "./actions";

export function ContactForm({ v, isParent }: { v: { phone?: string | null; phone2?: string | null; address?: string | null; workplace?: string | null }; isParent: boolean }) {
  return (
    <ActionForm action={updateMyContact} className="grid gap-4 sm:grid-cols-2">
      <Field name="phone" label="Telefon" required><Input type="tel" inputMode="tel" defaultValue={v.phone ?? ""} /></Field>
      {isParent && <>
        <Field name="phone2" label="Qo'shimcha telefon"><Input type="tel" inputMode="tel" defaultValue={v.phone2 ?? ""} /></Field>
        <Field name="address" label="Manzil" className="sm:col-span-2"><Input defaultValue={v.address ?? ""} /></Field>
        <Field name="workplace" label="Ish joyi" className="sm:col-span-2"><Input defaultValue={v.workplace ?? ""} /></Field>
      </>}
      <div className="sm:col-span-2"><SubmitButton>Saqlash</SubmitButton></div>
    </ActionForm>
  );
}
