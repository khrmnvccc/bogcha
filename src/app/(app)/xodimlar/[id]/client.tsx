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

export function EditEmployee({ employee, defaults }: { employee: EmployeeValues; defaults: { start: string; end: string; days: number[] } }) {
  return (
    <FormDialog wide title="Xodimni tahrirlash" action={updateEmployee} trigger={<Button variant="outline" size="sm"><Pencil className="h-4 w-4" /> Tahrirlash</Button>}>
      <EmployeeFields v={employee} defaults={defaults} />
    </FormDialog>
  );
}

export function EmployeeGroupsForm({ employeeId, groups, selected }: { employeeId: string; groups: { id: string; name: string }[]; selected: string[] }) {
  const router = useRouter();
  return (
    <ActionForm action={setEmployeeGroups} onSuccess={() => router.refresh()} className="space-y-3">
      <input type="hidden" name="id" value={employeeId} />
      <GroupChecklist groups={groups} selected={selected} />
      {groups.length > 0 && <SubmitButton size="sm" variant="outline">Saqlash</SubmitButton>}
    </ActionForm>
  );
}

export function CreateAccountForm({ employeeId, suggested, canLeadership }: { employeeId: string; suggested: string; canLeadership: boolean }) {
  const [creds, setCreds] = React.useState<Credentials | null>(null);
  const router = useRouter();
  return (
    <>
      <p className="text-sm text-slate-500">Bu xodimning tizimga kirish hisobi yo&apos;q.</p>
      <ActionForm action={createEmployeeAccount} className="space-y-4" onSuccess={(s) => { setCreds(s.data?.creds as Credentials); }}>
        <input type="hidden" name="id" value={employeeId} />
        <AccountFields suggested={suggested} canLeadership={canLeadership} />
        <SubmitButton size="sm">Hisob yaratish</SubmitButton>
      </ActionForm>
      <CredentialsDialog creds={creds} onClose={() => { setCreds(null); router.refresh(); }} />
    </>
  );
}
