"use client";
import { Pencil, Plus } from "lucide-react";
import { FormDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/action-form";
import { Input, Select, Checkbox } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveGroup } from "./actions";
import { useI18n } from "@/lib/i18n/client";

export type GroupValues = {
  id: string; name: string; age_range: string | null; room: string | null; capacity: number | null;
  monthly_fee: number | null; academic_period_id: string | null; teacher_ids: string[];
};

export function GroupForm({ group, teachers, periods, defaultFee }: {
  group?: GroupValues; teachers: { id: string; full_name: string; position: string }[];
  periods: { id: string; name: string }[]; defaultFee: string;
}) {
  const { t } = useI18n();
  return (
    <FormDialog
      wide
      title={group ? t("Guruhni tahrirlash") : t("Yangi guruh")}
      action={saveGroup}
      hidden={group ? { id: group.id, teachers_submitted: "1" } : { teachers_submitted: "1" }}
      trigger={group
        ? <Button variant="ghost" size="sm"><Pencil className="h-4 w-4" />{" "}{t("Tahrirlash")}</Button>
        : <Button><Plus className="h-4 w-4" />{" "}{t("Yangi guruh")}</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label={t("Guruh nomi")} required><Input defaultValue={group?.name} placeholder={t("Quyoshcha")} /></Field>
        <Field name="age_range" label={t("Yosh oralig'i")}><Input defaultValue={group?.age_range ?? ""} placeholder={t("3-4 yosh")} /></Field>
        <Field name="room" label={t("Xona (sinf)")}><Input defaultValue={group?.room ?? ""} placeholder={t("2-qavat, 12-xona")} /></Field>
        <Field name="capacity" label={t("Sig'imi (bolalar soni)")}><Input type="number" min={1} max={200} defaultValue={group?.capacity ?? ""} /></Field>
        <Field name="monthly_fee" label={t("Oylik to'lov (so'm)")} hint={t("Bo'sh qolsa umumiy summa: {0}", [defaultFee])}>
          <Input inputMode="numeric" defaultValue={group?.monthly_fee ?? ""} placeholder="1 200 000" />
        </Field>
        <Field name="academic_period_id" label={t("O'quv davri")}>
          <Select defaultValue={group?.academic_period_id ?? ""}>
            <option value="">—</option>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-800">{t("Tarbiyachilar")}</p>
        {teachers.length === 0 ? <p className="text-sm text-slate-500">{t("Faol xodimlar yo'q")}</p> : (
          <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
            {teachers.map((t) => (
              <Checkbox key={t.id} name="teacher_ids" value={t.id} label={t.full_name} hint={t.position} defaultChecked={group?.teacher_ids.includes(t.id)} />
            ))}
          </div>
        )}
      </div>
    </FormDialog>
  );
}
