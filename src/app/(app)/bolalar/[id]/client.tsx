"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, UserPlus, Unlink } from "lucide-react";
import { FormDialog, ConfirmAction } from "@/components/ui/dialog";
import { Field, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CredentialsDialog, type Credentials } from "@/components/credentials";
import { NOTE_CATEGORY } from "@/lib/labels";
import { ChildFields, GuardianFields, GuardianPicker, type ChildValues } from "../forms";
import { updateChild, addGuardian, updateGuardian, unlinkGuardian, createParentAccount, addPickup, removePickup, addNote, deleteNote } from "../actions";
import { useI18n } from "@/lib/i18n/client";

export function EditChild({ child, groups }: { child: ChildValues; groups: { id: string; name: string }[] }) {
  const { t } = useI18n();
  return (
    <FormDialog wide title={t("Bola ma'lumotlarini tahrirlash")} action={updateChild} trigger={<Button variant="outline"><Pencil className="h-4 w-4" />{" "}{t("Tahrirlash")}</Button>}>
      <ChildFields v={child} groups={groups} />
    </FormDialog>
  );
}

export function AddGuardian({ childId, guardians }: { childId: string; guardians: { id: string; full_name: string; phone: string }[] }) {
  const { t } = useI18n();
  return (
    <FormDialog wide title={t("Ota-ona yoki vasiy qo'shish")} action={addGuardian} hidden={{ child_id: childId }}
      trigger={<Button variant="outline" size="sm"><Plus className="h-4 w-4" />{" "}{t("Qo'shish")}</Button>}>
      <GuardianPicker guardians={guardians} />
    </FormDialog>
  );
}

type GuardianEdit = {
  id: string; full_name: string; phone: string; phone2: string | null; address: string | null; workplace: string | null;
  telegram_chat_id: string | null; relationship: string; can_pickup: boolean;
};

export function EditGuardian({ childId, g }: { childId: string; g: GuardianEdit }) {
  const { t } = useI18n();
  return (
    <FormDialog wide title={t("Ota-ona ma'lumotlari")} action={updateGuardian} hidden={{ child_id: childId, guardian_id: g.id }}
      trigger={<Button variant="ghost" size="sm" aria-label={t("Tahrirlash")}><Pencil className="h-4 w-4" /></Button>}>
      <GuardianFields v={g} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="telegram_chat_id" label={t("Telegram chat ID")} hint={t("Telegram xabarnomalari uchun (ixtiyoriy)")}>
          <Input defaultValue={g.telegram_chat_id ?? ""} inputMode="numeric" />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
          <input type="checkbox" name="can_pickup" defaultChecked={g.can_pickup} className="h-4 w-4 rounded border-slate-300 text-brand-600" />{t("Bolani olib keta oladi")}</label>
      </div>
    </FormDialog>
  );
}

export function UnlinkGuardian({ childId, guardianId, name }: { childId: string; guardianId: string; name: string }) {
  const { t } = useI18n();
  return (
    <ConfirmAction trigger={<Button variant="ghost" size="sm" aria-label={t("Bog'lanishni olib tashlash")}><Unlink className="h-4 w-4 text-red-500" /></Button>}
      title={t("Bog'lanishni olib tashlaysizmi?")}
      description={t("{0} endi bu bolaning davomati, to'lovlari va ma'lumotlarini ko'ra olmaydi.", [name])}
      action={unlinkGuardian} hidden={{ child_id: childId, guardian_id: guardianId }} confirmText={t("Olib tashlash")} />
  );
}

export function ParentAccountButton({ guardianId, suggested }: { guardianId: string; suggested: string }) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [creds, setCreds] = React.useState<Credentials | null>(null);
  const router = useRouter();
  return (
    <>
      {open ? (
        <ActionForm action={createParentAccount} className="mt-2 flex flex-wrap items-end gap-2" onSuccess={(s) => { setOpen(false); setCreds(s.data?.creds as Credentials); }}>
          <input type="hidden" name="guardian_id" value={guardianId} />
          <Field name="username" label={t("Login")}><Input defaultValue={suggested} className="h-8 w-48" autoCapitalize="none" /></Field>
          <SubmitButton size="sm">{t("Yaratish")}</SubmitButton>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t("Bekor")}</Button>
        </ActionForm>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" />{" "}{t("Kabinet yaratish")}</Button>
      )}
      <CredentialsDialog creds={creds} onClose={() => { setCreds(null); router.refresh(); }} />
    </>
  );
}

export function AddPickup({ childId }: { childId: string }) {
  const { t } = useI18n();
  return (
    <FormDialog title={t("Olib ketuvchi qo'shish")} description={t("Bolani olib ketishga ruxsat berilgan shaxs")} action={addPickup} hidden={{ child_id: childId }}
      trigger={<Button variant="outline" size="sm"><Plus className="h-4 w-4" />{" "}{t("Qo'shish")}</Button>}>
      <Field name="full_name" label={t("F.I.Sh.")} required><Input /></Field>
      <Field name="relationship" label={t("Kimligi")} required><Input placeholder={t("Buvisi")} list="relationships" /></Field>
      <Field name="phone" label={t("Telefon")} required><Input type="tel" inputMode="tel" /></Field>
    </FormDialog>
  );
}

export function RemovePickup({ id, childId }: { id: string; childId: string }) {
  const { t } = useI18n();
  return (
    <ConfirmAction trigger={<Button variant="ghost" size="sm" aria-label={t("O'chirish")}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
      title={t("Olib ketuvchini o'chirasizmi?")} description={t("Bu shaxs ro'yxatdan olib tashlanadi.")} action={removePickup} hidden={{ id, child_id: childId }} confirmText={t("O'chirish")} />
  );
}

export function AddNote({ childId, canSensitive }: { childId: string; canSensitive: boolean }) {
  const { t } = useI18n();
  return (
    <FormDialog title={t("Izoh qo'shish")} description={t("Izohlar ota-onalar va hisobchiga ko'rinmaydi")} action={addNote} hidden={{ child_id: childId }}
      trigger={<Button variant="outline" size="sm"><Plus className="h-4 w-4" />{" "}{t("Izoh")}</Button>}>
      <Field name="category" label={t("Turi")} required>
        <Select defaultValue="general">
          {Object.entries(NOTE_CATEGORY).filter(([k]) => canSensitive || ["medical", "allergy", "general"].includes(k))
            .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field name="body" label={t("Izoh matni")} required><Textarea rows={4} /></Field>
    </FormDialog>
  );
}

export function DeleteNote({ id, childId }: { id: string; childId: string }) {
  const { t } = useI18n();
  return (
    <ConfirmAction trigger={<Button variant="ghost" size="sm" aria-label={t("O'chirish")}><Trash2 className="h-4 w-4 text-slate-400" /></Button>}
      title={t("Izohni o'chirasizmi?")} description={t("O'chirilgan izoh audit jurnalida saqlanadi.")} action={deleteNote} hidden={{ id, child_id: childId }} confirmText={t("O'chirish")} />
  );
}
