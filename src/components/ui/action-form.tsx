"use client";
import * as React from "react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
  data?: Record<string, unknown>;
};
type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const FormErrors = React.createContext<Record<string, string[] | undefined>>({});

/** Form bound to a server action: shows toasts, field errors and pending state. */
export function ActionForm({
  action, children, className, resetOnSuccess = false, onSuccess, redirectTo, successToast = true,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (state: ActionState) => void;
  redirectTo?: string;
  successToast?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  useEffect(() => {
    if (state.ok === true) {
      if (state.message && successToast) toast.success(state.message);
      if (resetOnSuccess) ref.current?.reset();
      onSuccessRef.current?.(state);
      if (redirectTo) router.push(redirectTo);
    } else if (state.ok === false && state.message) {
      toast.error(state.message);
    }
  }, [state, resetOnSuccess, redirectTo, router, successToast]);

  return (
    <FormErrors.Provider value={state.ok === false ? state.errors ?? {} : {}}>
      <form ref={ref} action={formAction} className={className} noValidate>
        {children}
      </form>
    </FormErrors.Provider>
  );
}

export function Field({
  name, label, hint, children, className, required,
}: {
  name: string; label?: string; hint?: string; children: React.ReactNode; className?: string; required?: boolean;
}) {
  const errors = React.useContext(FormErrors);
  const err = errors[name]?.[0];
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <Label htmlFor={name}>
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </Label>
      )}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            id: name, name, "aria-invalid": err ? true : undefined,
          })
        : children}
      {err ? <p className="mt-1 text-xs text-red-600">{err}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function SubmitButton({ children, pendingText = "Saqlanmoqda...", ...props }: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? pendingText : children}
    </Button>
  );
}
