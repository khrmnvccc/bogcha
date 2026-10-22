"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, Unlock } from "lucide-react";
import { ConfirmAction } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CredentialsDialog, type Credentials } from "@/components/credentials";
import { ActionForm, SubmitButton, type ActionState } from "@/components/ui/action-form";
import { useI18n } from "@/lib/i18n/client";

type Act = (p: ActionState, fd: FormData) => Promise<ActionState>;

/** Password reset + activate/deactivate controls for one account. */
export function AccountActions({ profileId, isActive, resetAction, activeAction, disabled }: {
  profileId: string; isActive: boolean; resetAction: Act; activeAction: Act; disabled?: boolean;
}) {
  const { t } = useI18n();
  const [creds, setCreds] = React.useState<Credentials | null>(null);
  const router = useRouter();
  const wrappedReset: Act = async (p, fd) => {
    const res = await resetAction(p, fd);
    if (res.ok && res.data?.creds) setCreds(res.data.creds as Credentials);
    return res;
  };
  if (disabled) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmAction
        trigger={<Button variant="outline" size="sm"><KeyRound className="h-4 w-4" />{" "}{t("Parolni tiklash")}</Button>}
        title={t("Parolni tiklaysizmi?")}
        description={t("Yangi vaqtinchalik parol yaratiladi. Eski parol darhol ishlamay qoladi, foydalanuvchi keyingi kirishda yangi parol o'rnatadi.")}
        action={wrappedReset}
        hidden={{ profile_id: profileId }}
        confirmText={t("Tiklash")}
        danger={false}
      />
      {isActive ? (
        <ConfirmAction
          trigger={<Button variant="outline" size="sm" className="text-red-600"><Lock className="h-4 w-4" />{" "}{t("Faolsizlantirish")}</Button>}
          title={t("Hisobni faolsizlantirasizmi?")}
          description={t("Foydalanuvchi tizimga kira olmaydi va barcha ma'lumotlarga kirish to'xtatiladi. Keyinroq qayta faollashtirish mumkin.")}
          action={activeAction}
          hidden={{ profile_id: profileId, active: "false" }}
          confirmText={t("Faolsizlantirish")}
        />
      ) : (
        <ActionForm action={activeAction} onSuccess={() => router.refresh()}>
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="active" value="true" />
          <SubmitButton variant="outline" size="sm"><Unlock className="h-4 w-4" />{" "}{t("Faollashtirish")}</SubmitButton>
        </ActionForm>
      )}
      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
    </div>
  );
}
