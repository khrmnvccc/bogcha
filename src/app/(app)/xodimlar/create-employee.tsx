"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { CredentialsDialog, type Credentials } from "@/components/credentials";
import { EmployeeFields, AccountFields, GroupChecklist } from "./employee-form";
import { createEmployee } from "./actions";

export function CreateEmployee({ groups, defaults, canLeadership }: {
  groups: { id: string; name: string }[]; defaults: { start: string; end: string; days: number[] }; canLeadership: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [withAccount, setWithAccount] = React.useState(true);
  const [creds, setCreds] = React.useState<Credentials | null>(null);
  const router = useRouter();
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen} wide title="Yangi xodim" description="Xodim ma'lumotlari va (ixtiyoriy) tizimga kirish hisobi"
        trigger={<Button><UserPlus className="h-4 w-4" /> Yangi xodim</Button>}>
        <ActionForm action={createEmployee} className="space-y-6" onSuccess={(s) => {
          setOpen(false);
          const c = s.data?.creds as Credentials | undefined;
          if (c) setCreds(c);
          router.refresh();
        }}>
          <EmployeeFields defaults={defaults} />
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-800">Biriktirilgan guruhlar</p>
            <GroupChecklist groups={groups} />
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input type="checkbox" name="create_account" checked={withAccount} onChange={(e) => setWithAccount(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
              Tizimga kirish hisobini hozir yaratish
            </label>
            {withAccount && <AccountFields canLeadership={canLeadership} />}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
            <SubmitButton>Saqlash</SubmitButton>
          </div>
        </ActionForm>
      </Dialog>
      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
    </>
  );
}
