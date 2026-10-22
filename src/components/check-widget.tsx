"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn, LogOut, MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ActionState } from "@/components/ui/action-form";
import { ATTENDANCE_SOURCE } from "@/lib/labels";
import { formatTime, formatMinutes } from "@/lib/format";

type Rec = {
  check_in_at: string; check_out_at: string | null; check_in_source: string; check_out_source: string | null;
  late_minutes: number; early_leave_minutes: number; worked_minutes: number | null;
} | null;

type Act = (p: ActionState, fd: FormData) => Promise<ActionState>;

function subscribeClock(cb: () => void) {
  const t = setInterval(cb, 30_000);
  return () => clearInterval(t);
}

function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
  });
}

export function CheckWidget({ record, schedule, checkIn, checkOut, locationEnabled }: {
  record: Rec; schedule: string; checkIn: Act; checkOut: Act; locationEnabled: boolean;
}) {
  const [busy, setBusy] = React.useState<null | "in" | "out">(null);
  const nowMs = React.useSyncExternalStore(subscribeClock, () => Math.floor(Date.now() / 30_000) * 30_000, () => null);
  const now = nowMs == null ? null : new Date(nowMs);
  const router = useRouter();

  async function run(kind: "in" | "out") {
    if (busy) return; // guards against double taps
    setBusy(kind);
    try {
      const fd = new FormData();
      if (locationEnabled) {
        const pos = await getPosition();
        if (pos) {
          fd.set("lat", String(pos.coords.latitude));
          fd.set("lng", String(pos.coords.longitude));
          fd.set("acc", String(pos.coords.accuracy));
        } else {
          toast.message("Joylashuv aniqlanmadi, belgi o'zingiz belgilagan sifatida saqlanadi");
        }
      }
      const res = await (kind === "in" ? checkIn : checkOut)({}, fd);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const done = record?.check_out_at;
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-lg shadow-brand-700/20 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-brand-100">Hozirgi vaqt (Toshkent)</p>
          <p className="text-4xl font-semibold tabular-nums tracking-tight" suppressHydrationWarning>{now ? formatTime(now) : "--:--"}</p>
          <p className="mt-1 text-sm text-brand-100">Ish vaqtingiz: {schedule}</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {!record && (
            <Button size="lg" variant="success" disabled={busy !== null} onClick={() => run("in")} className="min-w-44">
              {busy === "in" ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />} Ishga keldim
            </Button>
          )}
          {record && !done && (
            <Button size="lg" variant="secondary" disabled={busy !== null} onClick={() => run("out")} className="min-w-44 bg-white text-brand-800 hover:bg-brand-50">
              {busy === "out" ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />} Ishdan ketdim
            </Button>
          )}
          {done && (
            <span className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2.5 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5" /> Bugungi ish kuni yakunlandi
            </span>
          )}
          {locationEnabled && !done && (
            <span className="flex items-center gap-1 text-xs text-brand-100"><MapPin className="h-3.5 w-3.5" /> Joylashuv so&apos;raladi (ixtiyoriy)</span>
          )}
        </div>
      </div>
      {record && (
        <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-white/10 p-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-brand-100">Keldi</p>
            <p className="text-lg font-semibold">{formatTime(record.check_in_at)}</p>
            <Badge tone={ATTENDANCE_SOURCE[record.check_in_source]?.tone} className="mt-1">{ATTENDANCE_SOURCE[record.check_in_source]?.label}</Badge>
          </div>
          <div>
            <p className="text-brand-100">Ketdi</p>
            <p className="text-lg font-semibold">{record.check_out_at ? formatTime(record.check_out_at) : "—"}</p>
          </div>
          <div>
            <p className="text-brand-100">Ishlangan vaqt</p>
            <p className="text-lg font-semibold">{record.worked_minutes != null ? formatMinutes(record.worked_minutes) : "davom etmoqda"}</p>
          </div>
          <div>
            <p className="text-brand-100">Kechikish</p>
            <p className="text-lg font-semibold">{record.late_minutes ? `${record.late_minutes} daqiqa` : "yo'q"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
