"use client";
import * as React from "react";
import { Field } from "@/components/ui/action-form";
import { Input, Select, Textarea, Checkbox } from "@/components/ui/input";
import { WEEKDAYS_SHORT, todayISO } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";

export type EmployeeValues = {
  id?: string; full_name?: string; phone?: string | null; position?: string; start_date?: string; end_date?: string | null;
  status?: string; schedule_start?: string | null; schedule_end?: string | null; notes?: string | null; work_days?: number[] | null;
};

export function EmployeeFields({ v = {}, defaults }: { v?: EmployeeValues; defaults: { start: string; end: string; days: number[] } }) {
  const { t, f } = useI18n();
  const [custom, setCustom] = React.useState(Boolean(v.work_days));
  const days = v.work_days ?? defaults.days;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <Field name="full_name" label={t("F.I.Sh.")} required className="sm:col-span-2">
        <Input defaultValue={v.full_name} placeholder={t("Karimova Aziza Rustamovna")} />
      </Field>
      <Field name="phone" label={t("Telefon")} required>
        <Input type="tel" inputMode="tel" defaultValue={v.phone ?? ""} placeholder="+998 90 123 45 67" />
      </Field>
      <Field name="position" label={t("Lavozim")} required>
        <Input defaultValue={v.position} placeholder={t("Tarbiyachi")} list="positions" />
      </Field>
      <datalist id="positions">
        {["Tarbiyachi", "Yordamchi tarbiyachi", "Metodist", "Psixolog", "Logoped", "Musiqa rahbari", "Oshpaz", "Hamshira", "Qorovul", "Farrosh", "Hisobchi", "Administrator"].map((p) => <option key={p} value={t(p)} />)}
      </datalist>
      <Field name="start_date" label={t("Ishga kirgan sana")} required>
        <Input type="date" defaultValue={v.start_date ?? todayISO()} />
      </Field>
      <Field name="status" label={t("Holati")} required>
        <Select defaultValue={v.status ?? "active"}>
          <option value="active">{t("Faol")}</option>
          <option value="on_leave">{t("Ta'tilda")}</option>
          <option value="terminated">{t("Ishdan bo'shagan")}</option>
        </Select>
      </Field>
      {v.id && (
        <Field name="end_date" label={t("Ishdan ketgan sana")} hint={t("Faqat ishdan bo'shaganda")}>
          <Input type="date" defaultValue={v.end_date ?? ""} />
        </Field>
      )}
      <Field name="schedule_start" label={t("Ish boshlanishi")} hint={t("Bo'sh qolsa: {0}", [defaults.start])}>
        <Input type="time" defaultValue={v.schedule_start?.slice(0, 5) ?? ""} />
      </Field>
      <Field name="schedule_end" label={t("Ish tugashi")} hint={t("Bo'sh qolsa: {0}", [defaults.end])}>
        <Input type="time" defaultValue={v.schedule_end?.slice(0, 5) ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="custom_days" checked={custom} onChange={(e) => setCustom(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />{t("Alohida ish kunlari (umumiy jadvaldan farqli)")}</label>
        {custom && (
          <div className="mt-2 flex flex-wrap gap-2">
            {f.WEEKDAYS_SHORT.map((d, i) => (
              <label key={d} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                <input type="checkbox" name="work_days" value={i + 1} defaultChecked={days.includes(i + 1)} className="sr-only" />
                {d}
              </label>
            ))}
          </div>
        )}
      </div>
      <Field name="notes" label={t("Izoh")} className="sm:col-span-2">
        <Textarea defaultValue={v.notes ?? ""} rows={2} />
      </Field>
    </div>
  );
}

export function AccountFields({ suggested, canLeadership }: { suggested?: string; canLeadership: boolean }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="username" label={t("Login")} hint={t("Lotin harflari, raqam, nuqta")} required>
        <Input defaultValue={suggested} autoCapitalize="none" spellCheck={false} />
      </Field>
      <Field name="role" label={t("Tizimdagi roli")} required>
        <Select defaultValue="teacher">
          <option value="teacher">{t("Tarbiyachi / xodim")}</option>
          <option value="accountant">{t("Hisobchi / kassir")}</option>
          {canLeadership && <option value="admin">{t("Administrator")}</option>}
          {canLeadership && <option value="director">{t("Direktor")}</option>}
        </Select>
      </Field>
    </div>
  );
}

export function GroupChecklist({ groups, selected = [] }: { groups: { id: string; name: string }[]; selected?: string[] }) {
  const { t } = useI18n();
  if (!groups.length) return <p className="text-sm text-slate-500">{t("Hali guruhlar yo'q.")}</p>;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {groups.map((g) => (
        <Checkbox key={g.id} name="group_ids" value={g.id} label={g.name} defaultChecked={selected.includes(g.id)} />
      ))}
    </div>
  );
}
