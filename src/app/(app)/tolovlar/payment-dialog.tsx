"use client";
import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, Plus, FileDown } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton, type ActionState } from "@/components/ui/action-form";
import { Notice } from "@/components/ui/misc";
import { addMonthsISO, currentMonthISO, formatMonth, formatSom, todayISO } from "@/lib/format";
import { PAYMENT_METHOD } from "@/lib/labels";
import { recordPayment } from "./actions";
import { useI18n } from "@/lib/i18n/client";

export type ChildOption = { id: string; full_name: string; group?: string | null };

function Err({ e }: { e?: string[] }) {
  const { t } = useI18n();
  return e?.[0] ? <p className="mt-1 text-xs text-red-600">{t(e[0])}</p> : null;
}

export function PaymentDialog({ kids, preset, balance, compact }: {
  kids: ChildOption[]; preset?: { childId: string; month: string }; balance?: number; compact?: boolean;
}) {
  const { t, f } = useI18n();
  const [open, setOpenRaw] = React.useState(false);
  const [token, setToken] = React.useState("");
  const [last, setLast] = React.useState<string | null>(null);
  const router = useRouter();
  const months = React.useMemo(() => Array.from({ length: 18 }, (_, i) => addMonthsISO(currentMonthISO(), i - 12)), []);

  // A fresh idempotency token per opened form blocks double submission of the same payment.
  function setOpen(o: boolean) {
    if (o) setToken(crypto.randomUUID());
    setOpenRaw(o);
  }
  const [state, action] = useActionState(async (prev: ActionState, fd: FormData) => {
    const res = await recordPayment(prev, fd);
    if (res.ok) {
      toast.success(t(res.message ?? ""));
      setLast((res.data?.paymentId as string) ?? null);
      setOpenRaw(false);
      router.refresh();
    } else if (res.message) toast.error(t(res.message ?? ""));
    return res;
  }, {});

  const e = state.ok === false ? state.errors ?? {} : {};
  const curMonth = currentMonthISO();

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen} title={t("To'lov qabul qilish")}
        description={t("Naqd yoki bank o'tkazmasi orqali olingan to'lovni qayd eting. Onlayn to'lov tizimi ulanmagan.")}
        trigger={compact
          ? <Button size="sm" variant="success"><Banknote className="h-4 w-4" />{" "}{t("To'lov")}</Button>
          : <Button variant="success"><Plus className="h-4 w-4" />{" "}{t("To'lov qabul qilish")}</Button>}>
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="client_token" value={token} />
          <div>
            <Label htmlFor="child_id">{t("Bola")}{" "}<span className="text-red-500">*</span></Label>
            <Select id="child_id" name="child_id" defaultValue={preset?.childId ?? ""} aria-invalid={e.child_id ? true : undefined}>
              <option value="">{t("Tanlang")}</option>
              {kids.map((k) => <option key={k.id} value={k.id}>{k.full_name}{k.group ? ` · ${k.group}` : ""}</option>)}
            </Select>
            <Err e={e.child_id} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="month">{t("Qaysi oy uchun")}{" "}<span className="text-red-500">*</span></Label>
              <Select id="month" name="month" defaultValue={(preset?.month ?? curMonth).slice(0, 7)}>
                {months.map((m) => <option key={m} value={m.slice(0, 7)}>{f.formatMonth(m)}{m > curMonth ? t(" (avans)") : ""}</option>)}
              </Select>
              <Err e={e.month} />
            </div>
            <div>
              <Label htmlFor="amount">{t("Summa (so'm)")}{" "}<span className="text-red-500">*</span></Label>
              <Input id="amount" name="amount" inputMode="numeric" defaultValue={balance && balance > 0 ? String(balance) : ""} placeholder="1 200 000" aria-invalid={e.amount ? true : undefined} />
              {balance != null && balance > 0 && <p className="mt-1 text-xs text-slate-500">{t("Qoldiq:")}{" "}{f.formatSom(balance)}{t(". Qisman to'lov ham mumkin.")}</p>}
              <Err e={e.amount} />
            </div>
            <div>
              <Label htmlFor="method">{t("To'lov usuli")}{" "}<span className="text-red-500">*</span></Label>
              <Select id="method" name="method" defaultValue="cash">
                {Object.entries(PAYMENT_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="paid_on">{t("To'lov sanasi")}{" "}<span className="text-red-500">*</span></Label>
              <Input id="paid_on" name="paid_on" type="date" max={todayISO()} defaultValue={todayISO()} />
              <Err e={e.paid_on} />
            </div>
          </div>
          <div>
            <Label htmlFor="receipt_number">{t("Kvitansiya raqami")}</Label>
            <Input id="receipt_number" name="receipt_number" placeholder={t("Bo'sh qolsa avtomatik beriladi")} />
            <Err e={e.receipt_number} />
          </div>
          <div>
            <Label htmlFor="note">{t("Izoh")}</Label>
            <Textarea id="note" name="note" rows={2} placeholder={t("Masalan: bank to'lov topshirig'i №123")} />
          </div>
          {state.data?.duplicate === true && (
            <Notice tone="amber">
              <label className="flex items-start gap-2">
                <input type="checkbox" name="confirm_duplicate" value="1" className="mt-0.5 h-4 w-4" />{t("Ha, bu takroriy emas, alohida to'lov")}</label>
            </Notice>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>{t("Bekor qilish")}</Button>
            <SubmitButton variant="success">{t("Saqlash")}</SubmitButton>
          </div>
        </form>
      </Dialog>
      {last && !compact && (
        <a href={`/api/kvitansiya/${last}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <FileDown className="h-4 w-4" />{" "}{t("Oxirgi kvitansiya")}</a>
      )}
    </>
  );
}
