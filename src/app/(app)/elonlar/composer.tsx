"use client";
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { FormDialog, ConfirmAction } from "@/components/ui/dialog";
import { Field } from "@/components/ui/action-form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { publishAnnouncement, deleteAnnouncement } from "./actions";

export function Composer({ groups, guardians, isAdmin }: {
  groups: { id: string; name: string }[]; guardians: { id: string; full_name: string; phone: string }[]; isAdmin: boolean;
}) {
  const [aud, setAud] = React.useState(isAdmin ? "all_parents" : "group");
  return (
    <FormDialog wide title="Yangi e'lon" description="E'lon tanlangan qabul qiluvchilarga tizim ichida bildirishnoma sifatida yuboriladi." action={publishAnnouncement} submitText="E'lon qilish"
      trigger={<Button><Plus className="h-4 w-4" /> Yangi e&apos;lon</Button>}>
      <Field name="title" label="Sarlavha" required><Input placeholder="Masalan: Ertaga ochiq eshiklar kuni" /></Field>
      <Field name="body" label="Matn" required><Textarea rows={6} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="audience" label="Kimga" required>
          <Select value={aud} onChange={(e) => setAud(e.target.value)}>
            {isAdmin && <option value="all_parents">Barcha ota-onalar</option>}
            {isAdmin && <option value="everyone">Hamma (ota-onalar va xodimlar)</option>}
            {isAdmin && <option value="all_staff">Barcha xodimlar</option>}
            <option value="group">Tanlangan guruh</option>
            {isAdmin && <option value="guardian">Alohida ota-ona</option>}
          </Select>
        </Field>
        {aud === "group" && (
          <Field name="group_id" label="Guruh" required>
            <Select defaultValue=""><option value="">Tanlang</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
          </Field>
        )}
        {aud === "guardian" && (
          <Field name="guardian_id" label="Ota-ona" required>
            <Select defaultValue=""><option value="">Tanlang</option>{guardians.map((g) => <option key={g.id} value={g.id}>{g.full_name} · {g.phone}</option>)}</Select>
          </Field>
        )}
      </div>
      {isAdmin && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="is_pinned" className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Yuqoriga mahkamlash
        </label>
      )}
    </FormDialog>
  );
}

export function DeleteAnnouncement({ id }: { id: string }) {
  return (
    <ConfirmAction trigger={<Button variant="ghost" size="sm" aria-label="O'chirish"><Trash2 className="h-4 w-4 text-slate-400" /></Button>}
      title="E'lonni o'chirasizmi?" description="E'lon barcha qabul qiluvchilar uchun o'chiriladi." action={deleteAnnouncement} hidden={{ id }} confirmText="O'chirish" />
  );
}
