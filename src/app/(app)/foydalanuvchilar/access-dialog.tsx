"use client";
import { ShieldCheck } from "lucide-react";
import { FormDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/action-form";
import { Select, Checkbox } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PERMISSION_LABELS, ROLE_LABELS, type Role } from "@/lib/labels";
import { updateUserAccess } from "./actions";

export function AccessDialog({ profileId, role, permissions, canLeadership }: { profileId: string; role: Role; permissions: string[]; canLeadership: boolean }) {
  const roles: Role[] = role === "parent" ? ["parent"] : (["teacher", "accountant", ...(canLeadership ? ["admin", "director"] : [])] as Role[]);
  return (
    <FormDialog title="Kirish huquqlari" description="Rol asosiy huquqlarni belgilaydi. Qo'shimcha ruxsatlar faqat kerak bo'lganda beriladi." action={updateUserAccess} hidden={{ profile_id: profileId }}
      trigger={<Button variant="ghost" size="sm" aria-label="Huquqlar"><ShieldCheck className="h-4 w-4" /></Button>}>
      <Field name="role" label="Rol" required>
        <Select defaultValue={role} disabled={role === "parent"}>
          {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select>
      </Field>
      {role === "parent" && <input type="hidden" name="role" value="parent" />}
      {role !== "parent" && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">Qo&apos;shimcha ruxsatlar</p>
          {Object.entries(PERMISSION_LABELS).map(([k, v]) => (
            <Checkbox key={k} name="permissions" value={k} label={v.label} hint={v.hint} defaultChecked={permissions.includes(k)} />
          ))}
          <p className="text-xs text-slate-500">Direktor va administratorda barcha ruxsatlar avtomatik mavjud.</p>
        </div>
      )}
    </FormDialog>
  );
}
