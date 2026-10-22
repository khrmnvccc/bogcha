"use client";
import { Plus, MapPin } from "lucide-react";
import { toast } from "sonner";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { FormDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { WEEKDAYS } from "@/lib/format";
import type { Settings } from "@/lib/queries";
import { saveSettings, savePeriod } from "./actions";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-slate-100 pb-8 last:border-0 lg:grid-cols-3">
      <div><h2 className="font-semibold text-slate-900">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">{children}</div>
    </section>
  );
}

export function SettingsForm({ s }: { s: Settings }) {
  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      (document.getElementById("location_lat") as HTMLInputElement).value = pos.coords.latitude.toFixed(6);
      (document.getElementById("location_lng") as HTMLInputElement).value = pos.coords.longitude.toFixed(6);
      toast.success("Joylashuv olindi. Saqlashni unutmang.");
    }, () => toast.error("Joylashuvni aniqlab bo'lmadi"), { enableHighAccuracy: true });
  }
  return (
    <ActionForm action={saveSettings} className="space-y-8">
      <Section title="Bog'cha ma'lumotlari" description="Ota-onalar portalida va kvitansiyalarda ko'rinadi">
        <Field name="kindergarten_name" label="Bog'cha nomi" required className="sm:col-span-2"><Input defaultValue={s.kindergarten_name} /></Field>
        <Field name="address" label="Manzil" className="sm:col-span-2"><Input defaultValue={s.address ?? ""} /></Field>
        <Field name="phone" label="Telefon"><Input type="tel" defaultValue={s.phone ?? ""} /></Field>
        <Field name="phone2" label="Qo'shimcha telefon"><Input type="tel" defaultValue={s.phone2 ?? ""} /></Field>
        <Field name="email" label="Email"><Input type="email" defaultValue={s.email ?? ""} /></Field>
        <Field name="telegram" label="Telegram (kanal yoki @username)"><Input defaultValue={s.telegram ?? ""} /></Field>
        <Field name="working_hours_text" label="Ish vaqti (matn)" className="sm:col-span-2"><Input defaultValue={s.working_hours_text ?? ""} /></Field>
      </Section>
      <Section title="To'lovlar" description="Oylik hisoblar uchun standart qiymatlar. Guruh yoki bola uchun alohida summa belgilash mumkin.">
        <Field name="default_monthly_fee" label="Standart oylik to'lov (so'm)" required><Input inputMode="numeric" defaultValue={String(s.default_monthly_fee)} /></Field>
        <Field name="billing_due_day" label="To'lov muddati (oyning kuni)" required hint="1-28"><Input type="number" min={1} max={28} defaultValue={s.billing_due_day} /></Field>
      </Section>
      <Section title="Ish jadvali va davomat qoidalari" description="Kechikish, erta ketish va shubhali yozuvlarni aniqlash uchun">
        <Field name="work_start" label="Ish boshlanishi" required><Input type="time" defaultValue={s.work_start.slice(0, 5)} /></Field>
        <Field name="work_end" label="Ish tugashi" required><Input type="time" defaultValue={s.work_end.slice(0, 5)} /></Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-slate-700">Ish kunlari</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d, i) => (
              <label key={d} className="flex cursor-pointer items-center rounded-lg border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700">
                <input type="checkbox" name="work_days" value={i + 1} defaultChecked={s.work_days.includes(i + 1)} className="sr-only" />{d}
              </label>
            ))}
          </div>
        </div>
        <Field name="late_grace_minutes" label="Kechikish chegarasi (daqiqa)" hint="Shu daqiqagacha kechikish hisoblanmaydi"><Input type="number" min={0} defaultValue={s.late_grace_minutes} /></Field>
        <Field name="early_leave_grace_minutes" label="Erta ketish chegarasi (daqiqa)"><Input type="number" min={0} defaultValue={s.early_leave_grace_minutes} /></Field>
        <Field name="min_shift_minutes" label="Minimal ish vaqti (daqiqa)" hint="Undan kam bo'lsa tekshirishga yuboriladi"><Input type="number" min={0} defaultValue={s.min_shift_minutes} /></Field>
        <Field name="max_shift_minutes" label="Maksimal ish vaqti (daqiqa)" hint="Undan ko'p bo'lsa tekshirishga yuboriladi"><Input type="number" min={60} defaultValue={s.max_shift_minutes} /></Field>
      </Section>
      <Section title="Joylashuvni tasdiqlash" description="Ixtiyoriy. Belgilansa, xodim telefoni joylashuvi bog'cha hududida bo'lganda belgi 'Joylashuv tasdiqlangan' deb saqlanadi. Bu qurilma ma'lumotiga asoslanadi, biometrik tasdiq emas.">
        <Field name="location_lat" label="Kenglik (latitude)"><Input inputMode="decimal" defaultValue={s.location_lat ?? ""} placeholder="41.311081" /></Field>
        <Field name="location_lng" label="Uzunlik (longitude)"><Input inputMode="decimal" defaultValue={s.location_lng ?? ""} placeholder="69.240562" /></Field>
        <Field name="location_radius_m" label="Radius (metr)"><Input type="number" min={10} max={5000} defaultValue={s.location_radius_m} /></Field>
        <div className="flex items-end"><Button variant="outline" onClick={useMyLocation}><MapPin className="h-4 w-4" /> Hozirgi joylashuvim</Button></div>
      </Section>
      <div className="flex justify-end"><SubmitButton size="lg">Sozlamalarni saqlash</SubmitButton></div>
    </ActionForm>
  );
}

export function PeriodDialog() {
  return (
    <FormDialog title="Yangi o'quv davri" action={savePeriod} trigger={<Button variant="outline" size="sm"><Plus className="h-4 w-4" /> Qo&apos;shish</Button>}>
      <Field name="name" label="Nomi" required><Input placeholder="2026-2027 o'quv yili" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="start_date" label="Boshlanish" required><Input type="date" /></Field>
        <Field name="end_date" label="Tugash" required><Input type="date" /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_current" className="h-4 w-4" /> Joriy davr</label>
    </FormDialog>
  );
}
