"use client";
import * as React from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Input } from "@/components/ui/input";
import { signIn } from "@/app/auth-actions";

export function LoginForm({ next }: { next?: string }) {
  const [show, setShow] = React.useState(false);
  return (
    <ActionForm action={signIn} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field name="username" label="Login">
        <Input autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="masalan: aziza.karimova" required />
      </Field>
      <div className="relative">
        <Field name="password" label="Parol">
          <Input type={show ? "text" : "password"} autoComplete="current-password" required className="pr-10" />
        </Field>
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-[34px] rounded p-1 text-slate-400 hover:text-slate-600" aria-label={show ? "Parolni yashirish" : "Parolni ko'rsatish"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <SubmitButton className="w-full" size="lg" pendingText="Kirilmoqda...">
        <LogIn className="h-4 w-4" /> Kirish
      </SubmitButton>
    </ActionForm>
  );
}
