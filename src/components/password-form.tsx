"use client";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Input } from "@/components/ui/input";
import { changePassword } from "@/app/auth-actions";
import { useI18n } from "@/lib/i18n/client";

export function PasswordForm({ forced = false }: { forced?: boolean }) {
  const { t } = useI18n();
  return (
    <ActionForm action={changePassword} className="space-y-4" resetOnSuccess>
      {forced && <input type="hidden" name="forced" value="1" />}
      <Field name="current" label={forced ? t("Vaqtinchalik parol") : t("Joriy parol")} required>
        <Input type="password" autoComplete="current-password" />
      </Field>
      <Field name="password" label={t("Yangi parol")} hint={t("Kamida 8 belgi, harf va raqam bo'lsin")} required>
        <Input type="password" autoComplete="new-password" />
      </Field>
      <Field name="confirm" label={t("Yangi parolni takrorlang")} required>
        <Input type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton className={forced ? "w-full" : undefined}>{t("Parolni saqlash")}</SubmitButton>
    </ActionForm>
  );
}
