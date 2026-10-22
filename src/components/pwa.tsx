"use client";
import * as React from "react";
import { Download, Share, SquarePlus, X, Smartphone, CheckCircle2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type State = { ready: boolean; standalone: boolean; ios: boolean; prompt: PromptEvent | null };

// One shared store, so the banner and every install button see the same captured prompt.
let state: State = { ready: false, standalone: false, ios: false, prompt: null };
const SERVER: State = state;
const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
if (typeof window !== "undefined") {
  const nav = navigator as Navigator & { standalone?: boolean };
  state = {
    ready: true,
    standalone: window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true,
    ios: /iphone|ipad|ipod/i.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1),
    prompt: null,
  };
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    set({ prompt: e as PromptEvent });
  });
  window.addEventListener("appinstalled", () => set({ prompt: null, standalone: true }));
}

function usePwa() {
  return React.useSyncExternalStore(subscribe, () => state, () => SERVER);
}

export function PwaRegister() {
  React.useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

function IosSteps() {
  const { t } = useI18n();
  const steps = [
    { icon: <Share className="h-5 w-5" />, text: t("Safari pastidagi \"Ulashish\" tugmasini bosing") },
    { icon: <SquarePlus className="h-5 w-5" />, text: t("Ro'yxatdan \"Bosh ekranga qo'shish\" (На экран «Домой») ni tanlang") },
    { icon: <CheckCircle2 className="h-5 w-5" />, text: t("\"Qo'shish\" ni bosing — Bog'cha ikonkasi telefoningizda paydo bo'ladi") },
  ];
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">{s.icon}</span>
          <span><b className="mr-1">{i + 1}.</b>{s.text}</span>
        </li>
      ))}
    </ol>
  );
}

/** Returns a handler that installs the app, or opens iPhone instructions; null when installing isn't possible here. */
function useInstall() {
  const pwa = usePwa();
  const [iosOpen, setIosOpen] = React.useState(false);
  const canInstall = pwa.ready && !pwa.standalone && (pwa.prompt !== null || pwa.ios);
  async function install() {
    if (pwa.prompt) {
      await pwa.prompt.prompt();
      const { outcome } = await pwa.prompt.userChoice;
      if (outcome === "accepted") set({ prompt: null });
    } else if (pwa.ios) setIosOpen(true);
  }
  const dialog = (
    <Dialog open={iosOpen} onOpenChange={setIosOpen} title="iPhone'ga o'rnatish" description="Bog'chani oddiy ilova kabi bosh ekrandan oching.">
      <IosSteps />
    </Dialog>
  );
  return { pwa, canInstall, install, dialog };
}

export function InstallButton({ className, full }: { className?: string; full?: boolean }) {
  const { t } = useI18n();
  const { pwa, canInstall, install, dialog } = useInstall();
  if (pwa.standalone) return <p className={cn("flex items-center gap-2 text-sm text-mint-700", className)}><CheckCircle2 className="h-4 w-4" />{t("Ilova o'rnatilgan")}</p>;
  if (!canInstall) return null;
  return (
    <>
      <Button variant="outline" onClick={install} className={cn(full && "w-full", className)}><Download className="h-4 w-4" />{" "}{t("Ilovani o'rnatish")}</Button>
      {dialog}
    </>
  );
}

/** Info card for the profile page: always explains how to install, even where the browser offers no prompt. */
export function InstallCard() {
  const { t } = useI18n();
  const { pwa, canInstall, install, dialog } = useInstall();
  if (!pwa.ready) return null;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="h-14 w-14 rounded-2xl shadow-md" />
      <div className="min-w-0 flex-1 text-sm text-slate-600">
        {pwa.standalone ? t("Bog'cha ilova sifatida o'rnatilgan va ochilgan.")
          : t("Saytni telefon yoki kompyuterga ilova qilib o'rnating: bosh ekrandan bir bosishda ochiladi, to'liq ekranda ishlaydi.")}
        {!pwa.standalone && !canInstall && <p className="mt-1 text-xs text-slate-500">{t("Brauzer menyusidan \"Ilovani o'rnatish\" yoki \"Bosh ekranga qo'shish\" ni tanlang.")}</p>}
      </div>
      {!pwa.standalone && canInstall && <Button onClick={install}><Download className="h-4 w-4" />{" "}{t("O'rnatish")}</Button>}
      {pwa.standalone && <CheckCircle2 className="h-6 w-6 text-mint-600" />}
      {dialog}
    </div>
  );
}

const DISMISS_KEY = "bogcha.install.dismissed";

/** A small, dismissible prompt on phones. Comes back two weeks after being closed. */
export function InstallBanner() {
  const { t } = useI18n();
  const { canInstall, install, dialog } = useInstall();
  const [hidden, setHidden] = React.useState(true);
  React.useEffect(() => {
    let at = 0;
    try { at = Number(localStorage.getItem(DISMISS_KEY) ?? 0); } catch { /* storage blocked */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(Date.now() - at < 14 * 864e5);
  }, []);
  function dismiss() {
    setHidden(true);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* storage blocked */ }
  }
  if (hidden || !canInstall) return dialog;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 to-mint-50 p-3 lg:hidden">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white"><Smartphone className="h-5 w-5" /></span>
      <p className="min-w-0 flex-1 text-sm text-slate-700">{t("Bog'chani telefoningizga ilova qilib o'rnating")}</p>
      <Button size="sm" onClick={install}>{t("O'rnatish")}</Button>
      <button type="button" onClick={dismiss} aria-label={t("Yopish")} className="rounded-lg p-1 text-slate-400 hover:bg-white/60"><X className="h-4 w-4" /></button>
      {dialog}
    </div>
  );
}
