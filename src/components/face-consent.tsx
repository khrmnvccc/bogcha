"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScanFace } from "lucide-react";
import { setFaceConsent } from "@/lib/checkin-actions";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Parent's (or admin's) switch for face-based arrival checks. */
export function FaceConsent({ childId, value, compact }: { childId: string; value: boolean; compact?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [on, setOn] = React.useState(value);
  const [busy, setBusy] = React.useState(false);
  async function toggle() {
    setBusy(true);
    const res = await setFaceConsent(childId, !on);
    setBusy(false);
    if (res.ok) { setOn(!on); toast.success(res.message); router.refresh(); } else toast.error(res.message);
  }
  return (
    <div className={cn("flex items-start gap-3", !compact && "rounded-xl border border-slate-100 bg-slate-50/60 p-3")}>
      <ScanFace className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-slate-800">{t("Yuz orqali kelish-ketish")}</p>
        {!compact && <p className="mt-0.5 text-xs text-slate-500">{t("Tarbiyachi telefoni kamerasi bolaning yuzini rasmi bilan solishtiradi. Kamera tasviri saqlanmaydi va hech qayerga yuborilmaydi.")}</p>}
      </div>
      <button type="button" role="switch" aria-checked={on} disabled={busy} onClick={toggle} aria-label={t("Yuz orqali kelish-ketish")}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50", on ? "bg-mint-600" : "bg-slate-300")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}
