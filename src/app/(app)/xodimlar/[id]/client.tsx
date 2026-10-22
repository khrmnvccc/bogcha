"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { FormDialog } from "@/components/ui/dialog";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { CredentialsDialog, type Credentials } from "@/components/credentials";
import { EmployeeFields, AccountFields, GroupChecklist, type EmployeeValues } from "../employee-form";
import { updateEmployee, setEmployeeGroups, createEmployeeAccount } from "../actions";
import { useI18n } from "@/lib/i18n/client";

export function EditEmployee({ employee, defaults }: { employee: EmployeeValues; defaults: { start: string; end: string; days: number[] } }) {
  const { t } = useI18n();
  return (
    <FormDialog wide title={t("Xodimni tahrirlash")} action={updateEmployee} trigger={<Button variant="outline" size="sm"><Pencil className="h-4 w-4" />{" "}{t("Tahrirlash")}</Button>}>
      <EmployeeFields v={employee} defaults={defaults} />
    </FormDialog>
  );
}

export function EmployeeGroupsForm({ employeeId, groups, selected }: { employeeId: string; groups: { id: string; name: string }[]; selected: string[] }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <ActionForm action={setEmployeeGroups} onSuccess={() => router.refresh()} className="space-y-3">
      <input type="hidden" name="id" value={employeeId} />
      <GroupChecklist groups={groups} selected={selected} />
      {groups.length > 0 && <SubmitButton size="sm" variant="outline">{t("Saqlash")}</SubmitButton>}
    </ActionForm>
  );
}

export function CreateAccountForm({ employeeId, suggested, canLeadership }: { employeeId: string; suggested: string; canLeadership: boolean }) {
  const { t } = useI18n();
  const [creds, setCreds] = React.useState<Credentials | null>(null);
  const router = useRouter();
  return (
    <>
      <p className="text-sm text-slate-500">{t("Bu xodimning tizimga kirish hisobi yo'q.")}</p>
      <ActionForm action={createEmployeeAccount} className="space-y-4" onSuccess={(s) => { setCreds(s.data?.creds as Credentials); }}>
        <input type="hidden" name="id" value={employeeId} />
        <AccountFields suggested={suggested} canLeadership={canLeadership} />
        <SubmitButton size="sm">{t("Hisob yaratish")}</SubmitButton>
      </ActionForm>
      <CredentialsDialog creds={creds} onClose={() => { setCreds(null); router.refresh(); }} />
    </>
  );
}
