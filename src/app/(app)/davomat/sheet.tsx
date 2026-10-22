"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, CheckCheck, MessageSquarePlus, Save, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Notice } from "@/components/ui/misc";
import { ATTENDANCE_STATUS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { saveChildAttendance } from "./actions";
import { useI18n } from "@/lib/i18n/client";
import { Avatar } from "@/components/avatar";
import { formatTime } from "@/lib/format";

type Status = "present" | "absent" | "late" | "excused";
type Child = { id: string; full_name: string; status?: Status; note?: string | null; photo?: string | null; parentNote?: string | null; arrivedAt?: string | null; leftAt?: string | null };

const STYLES: Record<Status, string> = {
  present: "data-[on=true]:bg-mint-600 data-[on=true]:text-white data-[on=true]:border-mint-600",
  late: "data-[on=true]:bg-amber-500 data-[on=true]:text-white data-[on=true]:border-amber-500",
  absent: "data-[on=true]:bg-red-600 data-[on=true]:text-white data-[on=true]:border-red-600",
  excused: "data-[on=true]:bg-brand-500 data-[on=true]:text-white data-[on=true]:border-brand-500",
};
const ORDER: Status[] = ["present", "late", "absent", "excused"];

export function AttendanceSheet({ date, kids: children, editable, needsReason, lockedReason }: {
  date: string; kids: Child[]; editable: boolean; needsReason: boolean; lockedReason?: string;
}) {
  const { t } = useI18n();
  const initial = React.useMemo(() => Object.fromEntries(children.map((c) => [c.id, { status: c.status, note: c.note ?? "" }])), [children]);
  const [state, setState] = React.useState<Record<string, { status?: Status; note: string }>>(initial);
  const [notesOpen, setNotesOpen] = React.useState<Record<string, boolean>>({});
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const router = useRouter();
  const [prevInitial, setPrevInitial] = React.useState(initial);
  if (prevInitial !== initial) {
    // Server data changed (after save/refresh): reset local edits to it.
    setPrevInitial(initial);
    setState(initial);
  }

  const changed = children.filter((c) => state[c.id]?.status && (state[c.id].status !== c.status || (state[c.id].note || "") !== (c.note ?? "")));
  const counts = ORDER.map((s) => [s, Object.values(state).filter((v) => v.status === s).length] as const);
  const unmarked = children.filter((c) => !state[c.id]?.status).length;

  function set(id: string, patch: Partial<{ status: Status; note: string }>) {
    setState((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  }
  function markAllPresent() {
    setState((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.status ? v : { ...v, status: "present" as Status }])));
  }
  async function save() {
    if (!changed.length) return;
    setSaving(true);
    const fd = new FormData();
    fd.set("date", date);
    fd.set("items", JSON.stringify(changed.map((c) => ({ child_id: c.id, status: state[c.id].status, note: state[c.id].note || null }))));
    if (needsReason) fd.set("reason", reason);
    const res = await saveChildAttendance({}, fd);
    setSaving(false);
    if (res.ok) {
      toast.success(t(res.message ?? ""));
      setReason("");
      router.refresh();
    } else toast.error(t(res.message ?? ""));
  }

  return (
    <div>
      {!editable && lockedReason && <Notice tone="amber" className="m-4 flex items-center gap-2"><Lock className="h-4 w-4" />{lockedReason}</Notice>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap gap-2 text-sm">
          {counts.map(([s, n]) => (
            <span key={s} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{t(ATTENDANCE_STATUS[s].label)}: <b>{n}</b></span>
          ))}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">{t("Belgilanmagan:")}{" "}<b>{unmarked}</b></span>
        </div>
        {editable && unmarked > 0 && (
          <Button variant="outline" size="sm" onClick={markAllPresent}><CheckCheck className="h-4 w-4" />{" "}{t("Qolganlarni \"Keldi\"")}</Button>
        )}
      </div>
      <ul className="divide-y divide-slate-100">
        {children.map((c, idx) => {
          const v = state[c.id] ?? { note: "" };
          const dirty = v.status && (v.status !== c.status || (v.note || "") !== (c.note ?? ""));
          return (
            <li key={c.id} className={cn("px-4 py-3", dirty && "bg-brand-50/40")}>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="w-6 shrink-0 text-right text-xs text-slate-400">{idx + 1}</span>
                  <Avatar kind="child" id={c.id} name={c.full_name} version={c.photo} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">{c.full_name}</span>
                    {(c.arrivedAt || c.leftAt) && (
                      <span className="block text-xs text-slate-500">
                        {c.arrivedAt && <span className="text-mint-700">{t("Keldi")} {formatTime(c.arrivedAt)}</span>}
                        {c.leftAt && <span className="ml-2 text-brand-700">{t("Ketdi")} {formatTime(c.leftAt)}</span>}
                      </span>
                    )}
                    {c.parentNote != null && (
                      <span className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                        <BellRing className="h-3 w-3 shrink-0" /><span className="truncate">{t("Ota-ona: kelmaydi")}{c.parentNote ? ` · ${c.parentNote}` : ""}</span>
                      </span>
                    )}
                  </span>
                  {dirty && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" title={t("Saqlanmagan")} />}
                </div>
                <div className="grid grid-cols-4 gap-1.5 md:flex">
                  {ORDER.map((s) => (
                    <button key={s} type="button" disabled={!editable} data-on={v.status === s}
                      onClick={() => set(c.id, { status: s })}
                      className={cn("h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 transition md:px-3 md:text-sm", editable && "hover:bg-slate-50", STYLES[s])}>
                      {t(ATTENDANCE_STATUS[s].label)}
                    </button>
                  ))}
                  {editable && (
                    <button type="button" onClick={() => setNotesOpen((o) => ({ ...o, [c.id]: !o[c.id] }))} aria-label={t("Izoh qo'shish")}
                      className={cn("col-span-4 flex h-10 items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 text-xs text-slate-500 md:col-span-1 md:w-10", v.note && "border-solid border-brand-300 text-brand-600")}>
                      <MessageSquarePlus className="h-4 w-4" /><span className="md:hidden">{t("Izoh")}</span>
                    </button>
                  )}
                </div>
              </div>
              {(notesOpen[c.id] || (!editable && v.note)) && (
                <div className="mt-2 md:pl-9">
                  <Input value={v.note} disabled={!editable} onChange={(e) => set(c.id, { note: e.target.value })} maxLength={500} placeholder={t("Izoh (masalan: kasal, shifokorda)")} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {editable && (
        <div className="sticky bottom-0 space-y-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
          {needsReason && (
            <div>
              <Label htmlFor="reason">{t("O'tgan kunni tuzatish sababi")}{" "}<span className="text-red-500">*</span></Label>
              <Textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Masalan: kecha internet yo'q edi, qog'ozdagi jurnal bo'yicha kiritildi")} />
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">{changed.length ? t("{0} ta o'zgarish saqlanmagan", [changed.length]) : t("O'zgarishlar yo'q")}</span>
            <Button onClick={save} disabled={!changed.length || saving || (needsReason && reason.trim().length < 5)} size="lg">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}{t("Saqlash")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
