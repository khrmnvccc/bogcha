"use client";
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { FormDialog, ConfirmAction } from "@/components/ui/dialog";
import { Field } from "@/components/ui/action-form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { publishAnnouncement, deleteAnnouncement } from "./actions";
import { useI18n } from "@/lib/i18n/client";

export function Composer({ groups, guardians, isAdmin }: {
  groups: { id: string; name: string }[]; guardians: { id: string; full_name: string; phone: string }[]; isAdmin: boolean;
}) {
  const { t } = useI18n();
  const [aud, setAud] = React.useState(isAdmin ? "all_parents" : "group");
  return (
    <FormDialog wide title={t("Yangi e'lon")} description={t("E'lon tanlangan qabul qiluvchilarga tizim ichida bildirishnoma sifatida yuboriladi.")} action={publishAnnouncement} submitText={t("E'lon qilish")}
      trigger={<Button><Plus className="h-4 w-4" />{" "}{t("Yangi e'lon")}</Button>}>
      <Field name="title" label={t("Sarlavha")} required><Input placeholder={t("Masalan: Ertaga ochiq eshiklar kuni")} /></Field>
      <Field name="body" label={t("Matn")} required><Textarea rows={6} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="audience" label={t("Kimga")} required>
          <Select value={aud} onChange={(e) => setAud(e.target.value)}>
            {isAdmin && <option value="all_parents">{t("Barcha ota-onalar")}</option>}
            {isAdmin && <option value="everyone">{t("Hamma (ota-onalar va xodimlar)")}</option>}
            {isAdmin && <option value="all_staff">{t("Barcha xodimlar")}</option>}
            <option value="group">{t("Tanlangan guruh")}</option>
            {isAdmin && <option value="guardian">{t("Alohida ota-ona")}</option>}
          </Select>
        </Field>
        {aud === "group" && (
          <Field name="group_id" label={t("Guruh")} required>
            <Select defaultValue=""><option value="">{t("Tanlang")}</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
          </Field>
        )}
        {aud === "guardian" && (
          <Field name="guardian_id" label={t("Ota-ona")} required>
            <Select defaultValue=""><option value="">{t("Tanlang")}</option>{guardians.map((g) => <option key={g.id} value={g.id}>{g.full_name} · {g.phone}</option>)}</Select>
          </Field>
        )}
      </div>
      {isAdmin && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="is_pinned" className="h-4 w-4 rounded border-slate-300 text-brand-600" />{" "}{t("Yuqoriga mahkamlash")}</label>
      )}
    </FormDialog>
  );
}

export function DeleteAnnouncement({ id }: { id: string }) {
  const { t } = useI18n();
  return (
    <ConfirmAction trigger={<Button variant="ghost" size="sm" aria-label={t("O'chirish")}><Trash2 className="h-4 w-4 text-slate-400" /></Button>}
      title={t("E'lonni o'chirasizmi?")} description={t("E'lon barcha qabul qiluvchilar uchun o'chiriladi.")} action={deleteAnnouncement} hidden={{ id }} confirmText={t("O'chirish")} />
  );
}
