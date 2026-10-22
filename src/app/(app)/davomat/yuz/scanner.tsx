"use client";
import * as React from "react";
import { toast } from "sonner";
import { Camera, CameraOff, Check, Loader2, LogIn, LogOut, RefreshCw, ScanFace, SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/misc";
import { Avatar, photoUrl } from "@/components/avatar";
import { childCheck } from "@/lib/checkin-actions";
import { formatTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export type ScanKid = {
  id: string; name: string; photo: string | null; consent: boolean;
  status: string | null; arrivedAt: string | null; leftAt: string | null;
};
type FaceApi = typeof import("@vladmandic/face-api");
type Mode = "in" | "out";
type Candidate = { kid: ScanKid; distance: number };

const MATCH = 0.5; // face-api's usual threshold for "same person"
const STREAK = 3; // the same child must win this many frames in a row
const IGNORE_MS = 8000;

// Same answer on the server and in the browser, so hydration matches.
function tashkentHour() {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Tashkent" }).format(new Date()));
}

/**
 * Recognises children on the teacher's phone. Reference descriptors are computed in the browser
 * from the children's profile photos each time the page opens; nothing biometric is stored or sent.
 */
export function FaceScanner({ kids: initial }: { kids: ScanKid[] }) {
  const { t } = useI18n();
  const [kids, setKids] = React.useState(initial);
  const [mode, setMode] = React.useState<Mode>(() => (tashkentHour() >= 13 ? "out" : "in"));
  const [phase, setPhase] = React.useState<"idle" | "models" | "enroll" | "ready" | "error">("idle");
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [noFace, setNoFace] = React.useState<string[]>([]);
  const [camError, setCamError] = React.useState<string | null>(null);
  const [facing, setFacing] = React.useState<"user" | "environment">("environment");
  const [camOn, setCamOn] = React.useState(false);
  const [candidate, setCandidate] = React.useState<Candidate | null>(null);
  const [hint, setHint] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const api = React.useRef<FaceApi | null>(null);
  const refs = React.useRef<{ id: string; d: Float32Array }[]>([]);
  const video = React.useRef<HTMLVideoElement>(null);
  const stream = React.useRef<MediaStream | null>(null);
  const loop = React.useRef<number | null>(null);
  const streak = React.useRef<{ id: string; n: number }>({ id: "", n: 0 });
  const ignored = React.useRef(new Map<string, number>());
  const paused = React.useRef(false);

  const eligible = kids.filter((k) => k.consent && k.photo);
  const kidsById = React.useMemo(() => new Map(kids.map((k) => [k.id, k])), [kids]);

  async function prepare() {
    try {
      setPhase("models");
      const faceapi = await import("@vladmandic/face-api");
      await (faceapi.tf as unknown as { ready: () => Promise<void> }).ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      api.current = faceapi;
      setPhase("enroll");
      setProgress({ done: 0, total: eligible.length });
      const out: { id: string; d: Float32Array }[] = [];
      const missing: string[] = [];
      for (const [i, k] of eligible.entries()) {
        const img = new Image();
        img.src = photoUrl("child", k.id, k.photo!);
        await img.decode().catch(() => {});
        const r = await Promise.resolve(faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
          .withFaceLandmarks().withFaceDescriptor()).catch(() => undefined);
        if (r) out.push({ id: k.id, d: r.descriptor }); else missing.push(k.id);
        setProgress({ done: i + 1, total: eligible.length });
      }
      refs.current = out;
      setNoFace(missing);
      setPhase("ready");
      await startCamera(facing);
    } catch (e) {
      console.error(e);
      setPhase("error");
    }
  }

  async function startCamera(face: "user" | "environment") {
    stopCamera();
    setCamError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play().catch(() => {});
      }
      setCamOn(true);
      paused.current = false;
      tick();
    } catch (e) {
      const name = (e as DOMException)?.name;
      setCamError(name === "NotAllowedError" ? t("Kameraga ruxsat bering: brauzer sozlamalarida ushbu sayt uchun kamerani yoqing.")
        : t("Kamerani ochib bo'lmadi. Boshqa ilova kamerani ishlatayotgan bo'lishi mumkin."));
      setCamOn(false);
    }
  }

  function stopCamera() {
    if (loop.current) window.clearTimeout(loop.current);
    loop.current = null;
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    setCamOn(false);
  }

  React.useEffect(() => () => stopCamera(), []);

  function tick() {
    loop.current = window.setTimeout(async () => {
      const faceapi = api.current;
      const v = video.current;
      if (!faceapi || !v || !stream.current) return;
      if (!paused.current && v.readyState >= 2 && refs.current.length) {
        const r = await Promise.resolve(faceapi.detectSingleFace(v, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
          .withFaceLandmarks().withFaceDescriptor()).catch(() => undefined);
        if (!r) { setHint(t("Yuz qidirilmoqda...")); streak.current = { id: "", n: 0 }; }
        else {
          let best = { id: "", dist: Infinity };
          for (const ref of refs.current) {
            const dist = faceapi.euclideanDistance(r.descriptor, ref.d);
            if (dist < best.dist) best = { id: ref.id, dist };
          }
          const now = Date.now();
          const ign = ignored.current.get(best.id) ?? 0;
          if (best.dist > MATCH) { setHint(t("Tanilmadi. Yaqinroq keling yoki yorug'roq joyga o'ting.")); streak.current = { id: "", n: 0 }; }
          else if (now < ign) setHint("");
          else {
            streak.current = streak.current.id === best.id ? { id: best.id, n: streak.current.n + 1 } : { id: best.id, n: 1 };
            setHint(t("Tekshirilmoqda..."));
            if (streak.current.n >= STREAK) {
              const kid = kidsById.get(best.id);
              if (kid) { paused.current = true; setCandidate({ kid, distance: best.dist }); }
              streak.current = { id: "", n: 0 };
            }
          }
        }
      }
      tick();
    }, 300);
  }

  function release(id: string) {
    // eslint-disable-next-line react-hooks/purity -- runs from click handlers, not during render
    ignored.current.set(id, Date.now() + IGNORE_MS);
    setCandidate(null);
    setHint("");
    paused.current = false;
  }

  async function mark(kid: ScanKid, action: Mode, method: "face" | "manual") {
    setSaving(true);
    const res = await childCheck(kid.id, action, method);
    setSaving(false);
    if (res.ok) {
      const at = (res.data?.at as string) ?? new Date().toISOString();
      setKids((ks) => ks.map((k) => k.id === kid.id
        ? { ...k, status: action === "in" && !["present", "late"].includes(k.status ?? "") ? "present" : k.status, arrivedAt: action === "in" ? at : k.arrivedAt, leftAt: action === "out" ? at : k.leftAt }
        : k));
      toast.success(`${kid.name}: ${res.message}`);
    } else toast.error(res.message);
    return res.ok;
  }

  // The candidate shown must reflect the latest local state (e.g. after a manual mark).
  const cand = candidate ? { ...candidate, kid: kidsById.get(candidate.kid.id) ?? candidate.kid } : null;
  const doneFor = (k: ScanKid, m: Mode) => (m === "in" ? Boolean(k.arrivedAt) : Boolean(k.leftAt));
  const blocked = (k: ScanKid, m: Mode) => m === "out" && !k.arrivedAt;
  const arrived = kids.filter((k) => k.arrivedAt).length;
  const left = kids.filter((k) => k.leftAt).length;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          {(["in", "out"] as Mode[]).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={cn("flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition", mode === m ? (m === "in" ? "bg-mint-600 text-white shadow" : "bg-brand-600 text-white shadow") : "text-slate-600")}>
              {m === "in" ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}{m === "in" ? t("Keldi") : t("Ketdi")}
            </button>
          ))}
        </div>

        <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl bg-slate-900 sm:aspect-[4/3]">
          <video ref={video} playsInline muted className={cn("h-full w-full object-cover", facing === "user" && "-scale-x-100", !camOn && "hidden")} />
          {camOn && <div className="pointer-events-none absolute left-1/2 top-[45%] h-[58%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-dashed border-white/70" />}
          {!camOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
              {phase === "idle" && (<>
                <ScanFace className="h-14 w-14 text-white/80" />
                <p className="text-sm text-white/80">{t("Yuzni tanish uchun model telefoningizga bir marta yuklanadi (taxminan 7 MB).")}</p>
                <Button size="lg" onClick={prepare} disabled={eligible.length === 0}><Camera className="h-5 w-5" />{" "}{t("Kamerani yoqish")}</Button>
              </>)}
              {(phase === "models" || phase === "enroll") && (<>
                <Loader2 className="h-10 w-10 animate-spin" />
                <p className="text-sm">{phase === "models" ? t("Model yuklanmoqda...") : t("Bolalar rasmlari tayyorlanmoqda: {0}/{1}", [progress.done, progress.total])}</p>
              </>)}
              {phase === "error" && (<>
                <CameraOff className="h-10 w-10" /><p className="text-sm">{t("Yuzni tanish modulini yuklab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.")}</p>
                <Button variant="secondary" onClick={prepare}><RefreshCw className="h-4 w-4" />{" "}{t("Qayta urinish")}</Button>
              </>)}
              {phase === "ready" && camError && (<>
                <CameraOff className="h-10 w-10" /><p className="text-sm">{camError}</p>
                <Button variant="secondary" onClick={() => startCamera(facing)}><RefreshCw className="h-4 w-4" />{" "}{t("Qayta urinish")}</Button>
              </>)}
            </div>
          )}
          {camOn && (
            <button type="button" onClick={() => { const f = facing === "user" ? "environment" : "user"; setFacing(f); startCamera(f); }}
              aria-label={t("Kamerani almashtirish")} className="absolute right-3 top-3 rounded-full bg-black/40 p-2.5 text-white backdrop-blur">
              <SwitchCamera className="h-5 w-5" />
            </button>
          )}
          {camOn && !cand && hint && <p className="absolute inset-x-3 bottom-3 rounded-lg bg-black/50 px-3 py-2 text-center text-sm text-white backdrop-blur">{hint}</p>}
          {cand && (
            <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white p-4 shadow-xl">
              <div className="flex items-center gap-3">
                <Avatar kind="child" id={cand.kid.id} name={cand.kid.name} version={cand.kid.photo} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{cand.kid.name}</p>
                  <p className="text-xs text-slate-500">{t("O'xshashlik: {0}%", [Math.round((1 - cand.distance) * 100)])}</p>
                </div>
              </div>
              {doneFor(cand.kid, mode) ? (
                <p className="mt-3 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
                  {mode === "in" ? t("Bugun kelgan: {0}", [formatTime(cand.kid.arrivedAt!)]) : t("Bugun ketgan: {0}", [formatTime(cand.kid.leftAt!)])}
                </p>
              ) : blocked(cand.kid, mode) ? (
                <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">{t("Avval bolaning kelganini belgilang")}</p>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => release(cand.kid.id)}><X className="h-4 w-4" />{" "}{doneFor(cand.kid, mode) || blocked(cand.kid, mode) ? t("Yopish") : t("Bu u emas")}</Button>
                <Button variant={mode === "in" ? "success" : "primary"} disabled={saving || doneFor(cand.kid, mode) || blocked(cand.kid, mode)}
                  onClick={async () => { await mark(cand.kid, mode, "face"); release(cand.kid.id); }}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{" "}{mode === "in" ? t("Keldi") : t("Ketdi")}
                </Button>
              </div>
            </div>
          )}
        </div>
        {eligible.length === 0 && (
          <Notice tone="amber">{t("Yuz orqali tekshirish uchun bolaning rasmi bo'lishi va ota-onasi rozilik berishi kerak. Hozircha bunday bola yo'q, pastdagi ro'yxatdan qo'lda belgilang.")}</Notice>
        )}
        <p className="text-center text-xs text-slate-400">{t("Yuz faqat shu telefonda solishtiriladi. Kamera tasviri saqlanmaydi va hech qayerga yuborilmaydi.")}</p>
      </div>

      <Card className="lg:col-span-2">
        <CardHeader title={t("Bugun")} description={t("Keldi: {0} · Ketdi: {1} · Jami: {2}", [arrived, left, kids.length])} />
        <ul className="divide-y divide-slate-100">
          {kids.map((k) => {
            const note = !k.photo ? t("Rasm yo'q") : !k.consent ? t("Rozilik yo'q") : noFace.includes(k.id) ? t("Rasmda yuz topilmadi") : null;
            return (
              <li key={k.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar kind="child" id={k.id} name={k.name} version={k.photo} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{k.name}</p>
                  <p className="text-xs text-slate-500">
                    {k.arrivedAt ? <span className="text-mint-700">↓ {formatTime(k.arrivedAt)}</span> : k.status && !["present", "late"].includes(k.status) ? t("Kelmagan") : t("Hali kelmagan")}
                    {k.leftAt && <span className="ml-2 text-brand-700">↑ {formatTime(k.leftAt)}</span>}
                    {note && <span className="ml-2 text-amber-600">· {note}</span>}
                  </p>
                </div>
                {!doneFor(k, mode) && !blocked(k, mode) && (
                  <Button size="sm" variant="outline" disabled={saving} onClick={() => mark(k, mode, "manual")}>{mode === "in" ? t("Keldi") : t("Ketdi")}</Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
