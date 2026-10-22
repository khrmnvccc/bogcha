"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import * as A from "@radix-ui/react-alert-dialog";
import { X, AlertTriangle } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { ActionForm, SubmitButton, Field, type ActionState } from "@/components/ui/action-form";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";

export function Dialog({
  trigger, title, description, children, open, onOpenChange, wide,
}: {
  trigger?: React.ReactNode; title: string; description?: string; children: React.ReactNode;
  open?: boolean; onOpenChange?: (o: boolean) => void; wide?: boolean;
}) {
  const { t } = useI18n();
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] data-[state=open]:animate-in" />
        <D.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6",
            wide ? "sm:max-w-2xl" : "sm:max-w-lg",
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <D.Title className="text-lg font-semibold text-slate-900">{t(title)}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-sm text-slate-500">{t(description)}</D.Description>
              ) : (
                <D.Description className="sr-only">{t(title)}</D.Description>
              )}
            </div>
            <D.Close className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label={t("Yopish")}>
              <X className="h-5 w-5" />
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Dialog that contains an ActionForm and closes itself on success. */
export function FormDialog({
  trigger, title, description, action, children, submitText = "Saqlash", wide, hidden,
}: {
  trigger: React.ReactNode; title: string; description?: string;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode; submitText?: string; wide?: boolean; hidden?: Record<string, string>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog trigger={trigger} title={title} description={description} open={open} onOpenChange={setOpen} wide={wide}>
      <ActionForm action={action} onSuccess={() => setOpen(false)} className="space-y-4">
        {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {children}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>{t("Bekor qilish")}</Button>
          <SubmitButton>{t(submitText)}</SubmitButton>
        </div>
      </ActionForm>
    </Dialog>
  );
}

/** Confirmation dialog for destructive or important actions; optional reason field. */
export function ConfirmAction({
  trigger, title, description, action, hidden, confirmText = "Tasdiqlash", danger = true, reasonLabel,
}: {
  trigger: React.ReactNode; title: string; description: string;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  hidden: Record<string, string>; confirmText?: string; danger?: boolean; reasonLabel?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  return (
    <A.Root open={open} onOpenChange={setOpen}>
      <A.Trigger asChild>{trigger}</A.Trigger>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px]" />
        <A.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex gap-4">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", danger ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600")}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <A.Title className="text-base font-semibold text-slate-900">{t(title)}</A.Title>
              <A.Description className="mt-1 text-sm text-slate-600">{t(description)}</A.Description>
            </div>
          </div>
          <ActionForm action={action} onSuccess={() => setOpen(false)} className="mt-5 space-y-4">
            {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            {reasonLabel && (
              <Field name="reason" label={reasonLabel} required>
                <Textarea rows={2} placeholder={t("Sababni qisqacha yozing")} />
              </Field>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <A.Cancel className={buttonClass("outline")}>{t("Bekor qilish")}</A.Cancel>
              <SubmitButton variant={danger ? "danger" : "primary"}>{t(confirmText)}</SubmitButton>
            </div>
          </ActionForm>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
