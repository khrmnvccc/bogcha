"use client";
import { CalendarX2, X } from "lucide-react";
import { FormDialog, ConfirmAction } from "@/components/ui/dialog";
import { Field } from "@/components/ui/action-form";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addDaysISO } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { reportAbsence, cancelAbsence } from "./actions";

export type AbsenceReport = { id: string; date: string; note: string | null };

/** Lets a parent tell the teacher in advance that the child will not come. */
export function AbsenceCard({ childId, childName, today, reports }: {
  childId: string; childName: string; today: string; reports: AbsenceReport[];
}) {
  const { t, f } = useI18n();
  const days = Array.from({ length: 15 }, (_, i) => addDaysISO(today, i));
  const label = (d: string) => d === today ? t("Bugun") : d === addDaysISO(today, 1) ? t("Ertaga") : `${f.weekdayName(d)}, ${f.formatDateLong(d)}`;
  return (
    <div className="space-y-2">
      {reports.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          <span className="flex min-w-0 items-center gap-2"><CalendarX2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("{0}: kelmaydi", [label(r.date)])}{r.note ? ` · ${r.note}` : ""}</span></span>
          <ConfirmAction danger={false} title="Xabarni bekor qilasizmi?" description="Tarbiyachi bola keladi deb hisoblaydi." confirmText="Ha, bekor qilish"
            action={cancelAbsence} hidden={{ id: r.id }}
            trigger={<button type="button" aria-label={t("Bekor qilish")} className="rounded p-1 text-brand-500 hover:bg-brand-100"><X className="h-4 w-4" /></button>} />
        </div>
      ))}
      <FormDialog title="Farzandim kelmaydi" description={t("{0} kelmasligi haqida tarbiyachiga xabar yuboriladi.", [childName])}
        submitText="Xabar yuborish" action={reportAbsence} hidden={{ child_id: childId }}
        trigger={<Button variant="outline" size="sm" className="w-full"><CalendarX2 className="h-4 w-4" />{" "}{t("Farzandim kelmaydi")}</Button>}>
        <Field name="date" label="Qaysi kuni" required>
          <Select defaultValue={today}>{days.map((d) => <option key={d} value={d}>{label(d)}</option>)}</Select>
        </Field>
        <Field name="note" label="Sabab (ixtiyoriy)">
          <Textarea rows={2} maxLength={300} placeholder={t("Masalan: shamollagan, shifokorga boramiz")} />
        </Field>
      </FormDialog>
    </div>
  );
}
