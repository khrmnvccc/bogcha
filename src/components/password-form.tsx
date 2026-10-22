"use client";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Input } from "@/components/ui/input";
import { changePassword } from "@/app/auth-actions";

export function PasswordForm({ forced = false }: { forced?: boolean }) {
  return (
    <ActionForm action={changePassword} className="space-y-4" resetOnSuccess>
      {forced && <input type="hidden" name="forced" value="1" />}
      <Field name="current" label={forced ? "Vaqtinchalik parol" : "Joriy parol"} required>
        <Input type="password" autoComplete="current-password" />
      </Field>
      <Field name="password" label="Yangi parol" hint="Kamida 8 belgi, harf va raqam bo'lsin" required>
        <Input type="password" autoComplete="new-password" />
      </Field>
      <Field name="confirm" label="Yangi parolni takrorlang" required>
        <Input type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton className={forced ? "w-full" : undefined}>Parolni saqlash</SubmitButton>
    </ActionForm>
  );
}
