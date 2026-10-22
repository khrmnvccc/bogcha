"use client";
import { Pencil, Plus, CheckCheck } from "lucide-react";
import { FormDialog, ConfirmAction } from "@/components/ui/dialog";
import { Field } from "@/components/ui/action-form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { todayISO } from "@/lib/format";
import { setAttendance, reviewAttendance } from "./actions";
import { useI18n } from "@/lib/i18n/client";

export function AttendanceEditor({ employees, initial }: {
  employees: { id: string; full_name: string }[];
  initial?: { employee_id: string; work_date: string; check_in: string; check_out: string };
}) {
  const { t } = useI18n();
  return (
    <FormDialog
      title={initial ? t("Davomatni tuzatish") : t("Davomatni qo'lda kiritish")}
      description={t("O'zgartirish sababi, kim va qachon o'zgartirgani audit jurnaliga yoziladi.")}
      action={setAttendance}
      trigger={initial
        ? <Button variant="ghost" size="sm" aria-label={t("Tuzatish")}><Pencil className="h-4 w-4" /></Button>
        : <Button variant="outline"><Plus className="h-4 w-4" />{" "}{t("Qo'lda kiritish")}</Button>}
    >
      <Notice tone="amber">{t("Qo'lda kiritilgan yozuv \"Administrator kiritgan\" deb belgilanadi.")}</Notice>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="employee_id" label={t("Xodim")} required className="sm:col-span-2">
          <Select defaultValue={initial?.employee_id ?? ""} disabled={Boolean(initial)}>
            <option value="">{t("Tanlang")}</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </Select>
        </Field>
        {initial && <input type="hidden" name="employee_id" value={initial.employee_id} />}
        <Field name="work_date" label={t("Sana")} required className="sm:col-span-2">
          <Input type="date" max={todayISO()} defaultValue={initial?.work_date ?? todayISO()} readOnly={Boolean(initial)} />
        </Field>
        <Field name="check_in" label={t("Kelish vaqti")} required>
          <Input type="time" defaultValue={initial?.check_in ?? ""} />
        </Field>
        <Field name="check_out" label={t("Ketish vaqti")}>
          <Input type="time" defaultValue={initial?.check_out ?? ""} />
        </Field>
        <Field name="reason" label={t("Sabab")} required className="sm:col-span-2">
          <Textarea rows={2} placeholder={t("Masalan: xodim telefonini uyda unutgan, direktor tasdiqladi")} />
        </Field>
      </div>
    </FormDialog>
  );
}

export function ReviewButton({ id }: { id: string }) {
  const { t } = useI18n();
  return (
    <ConfirmAction
      trigger={<Button variant="ghost" size="sm" aria-label={t("Ko'rib chiqildi")}><CheckCheck className="h-4 w-4 text-mint-600" /></Button>}
      title={t("Ko'rib chiqildi deb belgilaysizmi?")}
      description={t("Yozuv o'zgarmaydi, faqat tekshiruv holati yangilanadi.")}
      action={reviewAttendance}
      hidden={{ id }}
      danger={false}
      confirmText={t("Belgilash")}
      reasonLabel={t("Izoh")}
    />
  );
}
