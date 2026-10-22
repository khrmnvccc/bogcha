"use client";
import * as React from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Input } from "@/components/ui/input";
import { signIn } from "@/app/auth-actions";
import { useI18n } from "@/lib/i18n/client";

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [show, setShow] = React.useState(false);
  return (
    <ActionForm action={signIn} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field name="username" label={t("Login")}>
        <Input autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={t("masalan: aziza.karimova")} required />
      </Field>
      <div className="relative">
        <Field name="password" label={t("Parol")}>
          <Input type={show ? "text" : "password"} autoComplete="current-password" required className="pr-10" />
        </Field>
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-[34px] rounded p-1 text-slate-400 hover:text-slate-600" aria-label={show ? t("Parolni yashirish") : t("Parolni ko'rsatish")}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <SubmitButton className="w-full" size="lg" pendingText={t("Kirilmoqda...")}>
        <LogIn className="h-4 w-4" />{" "}{t("Kirish")}</SubmitButton>
    </ActionForm>
  );
}
