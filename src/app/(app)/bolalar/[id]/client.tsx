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

export function EditChild({ child, groups }: { child: ChildValues; groups: { id: string; name: string }[] }) {
  return (
    <FormDialog wide title="Bola ma'lumotlarini tahrirlash" action={updateChild} trigger={<Button variant="outline"><Pencil className="h-4 w-4" /> Tahrirlash</Button>}>
      <ChildFields v={child} groups={groups} />
    </FormDialog>
  );
}

export function AddGuardian({ childId, guardians }: { childId: string; guardians: { id: string; full_name: string; phone: string }[] }) {
  return (
    <FormDialog wide title="Ota-ona yoki vasiy qo'shish" action={addGuardian} hidden={{ child_id: childId }}
      trigger={<Button variant="outline" size="sm"><Plus className="h-4 w-4" /> Qo&apos;shish</Button>}>
      <GuardianPicker guardians={guardians} />
    </FormDialog>
  );
}

type GuardianEdit = {
  id: string; full_name: string; phone: string; phone2: string | null; address: string | null; workplace: string | null;
  telegram_chat_id: string | null; relationship: string; can_pickup: boolean;
};

export function EditGuardian({ childId, g }: { childId: string; g: GuardianEdit }) {
  return (
    <FormDialog wide title="Ota-ona ma'lumotlari" action={updateGuardian} hidden={{ child_id: childId, guardian_id: g.id }}
      trigger={<Button variant="ghost" size="sm" aria-label="Tahrirlash"><Pencil className="h-4 w-4" /></Button>}>
      <GuardianFields v={g} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="telegram_chat_id" label="Telegram chat ID" hint="Telegram xabarnomalari uchun (ixtiyoriy)">
          <Input defaultValue={g.telegram_chat_id ?? ""} inputMode="numeric" />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
          <input type="checkbox" name="can_pickup" defaultChecked={g.can_pickup} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
          Bolani olib keta oladi
        </label>
      </div>
    </FormDialog>
  );
}

export function UnlinkGuardian({ childId, guardianId, name }: { childId: string; guardianId: string; name: string }) {
  return (
    <ConfirmAction trigger={<Button variant="ghost" size="sm" aria-label="Bog'lanishni olib tashlash"><Unlink className="h-4 w-4 text-red-500" /></Button>}
      title="Bog'lanishni olib tashlaysizmi?"
      description={`${name} endi bu bolaning davomati, to'lovlari va ma'lumotlarini ko'ra olmaydi.`}
      action={unlinkGuardian} hidden={{ child_id: childId, guardian_id: guardianId }} confirmText="Olib tashlash" />
  );
}

export function ParentAccountButton({ guardianId, suggested }: { guardianId: string; suggested: string }) {
  const [open, setOpen] = React.useState(false);
  const [creds, setCreds] = React.useState<Credentials | null>(null);
  const router = useRouter();
  return (
    <>
      {open ? (
        <ActionForm action={createParentAccount} className="mt-2 flex flex-wrap items-end gap-2" onSuccess={(s) => { setOpen(false); setCreds(s.data?.creds as Credentials); }}>
          <input type="hidden" name="guardian_id" value={guardianId} />
          <Field name="username" label="Login"><Input defaultValue={suggested} className="h-8 w-48" autoCapitalize="none" /></Field>
          <SubmitButton size="sm">Yaratish</SubmitButton>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Bekor</Button>
        </ActionForm>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Kabinet yaratish</Button>
      )}
      <CredentialsDialog creds={creds} onClose={() => { setCreds(null); router.refresh(); }} />
    </>
  );
}

export function AddPickup({ childId }: { childId: string }) {
  return (
    <FormDialog title="Olib ketuvchi qo'shish" description="Bolani olib ketishga ruxsat berilgan shaxs" action={addPickup} hidden={{ child_id: childId }}
      trigger={<Button variant="outline" size="sm"><Plus className="h-4 w-4" /> Qo&apos;shish</Button>}>
      <Field name="full_name" label="F.I.Sh." required><Input /></Field>
      <Field name="relationship" label="Kimligi" required><Input placeholder="Buvisi" list="relationships" /></Field>
      <Field name="phone" label="Telefon" required><Input type="tel" inputMode="tel" /></Field>
    </FormDialog>
  );
}

export function RemovePickup({ id, childId }: { id: string; childId: string }) {
  return (
    <ConfirmAction trigger={<Button variant="ghost" size="sm" aria-label="O'chirish"><Trash2 className="h-4 w-4 text-red-500" /></Button>}
      title="Olib ketuvchini o'chirasizmi?" description="Bu shaxs ro'yxatdan olib tashlanadi." action={removePickup} hidden={{ id, child_id: childId }} confirmText="O'chirish" />
  );
}

export function AddNote({ childId, canSensitive }: { childId: string; canSensitive: boolean }) {
  return (
    <FormDialog title="Izoh qo'shish" description="Izohlar ota-onalar va hisobchiga ko'rinmaydi" action={addNote} hidden={{ child_id: childId }}
      trigger={<Button variant="outline" size="sm"><Plus className="h-4 w-4" /> Izoh</Button>}>
      <Field name="category" label="Turi" required>
        <Select defaultValue="general">
          {Object.entries(NOTE_CATEGORY).filter(([k]) => canSensitive || ["medical", "allergy", "general"].includes(k))
            .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field name="body" label="Izoh matni" required><Textarea rows={4} /></Field>
    </FormDialog>
  );
}

export function DeleteNote({ id, childId }: { id: string; childId: string }) {
  return (
    <ConfirmAction trigger={<Button variant="ghost" size="sm" aria-label="O'chirish"><Trash2 className="h-4 w-4 text-slate-400" /></Button>}
      title="Izohni o'chirasizmi?" description="O'chirilgan izoh audit jurnalida saqlanadi." action={deleteNote} hidden={{ id, child_id: childId }} confirmText="O'chirish" />
  );
}
