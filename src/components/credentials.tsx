"use client";
import * as React from "react";
import { Copy, Printer, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";

export type Credentials = { username: string; tempPassword: string; fullName?: string };

/** Shows freshly generated credentials exactly once. They are never stored or logged. */
export function CredentialsDialog({ creds, onClose }: { creds: Credentials | null; onClose: () => void }) {
  const text = creds ? `Login: ${creds.username}\nVaqtinchalik parol: ${creds.tempPassword}` : "";
  function copy() {
    navigator.clipboard.writeText(text).then(() => toast.success("Nusxa olindi"), () => toast.error("Nusxa olib bo'lmadi"));
  }
  function print() {
    if (!creds) return;
    const w = window.open("", "_blank", "width=420,height=360");
    if (!w) return;
    w.document.write(`<html><head><title>Kirish ma'lumotlari</title></head><body style="font-family:sans-serif;padding:24px">
      <h3>Bog'cha tizimiga kirish</h3>${creds.fullName ? `<p>${creds.fullName.replace(/</g, "&lt;")}</p>` : ""}
      <p>Login: <b>${creds.username}</b></p><p>Vaqtinchalik parol: <b style="font-family:monospace;font-size:18px">${creds.tempPassword}</b></p>
      <p style="font-size:12px;color:#555">Birinchi kirishda parolni almashtirish talab qilinadi.</p></body></html>`);
    w.document.close();
    w.print();
  }
  return (
    <Dialog open={Boolean(creds)} onOpenChange={(o) => !o && onClose()} title="Kirish ma'lumotlari tayyor">
      {creds && (
        <div className="space-y-4">
          <Notice tone="amber">
            Bu parol faqat hozir ko&apos;rsatiladi va hech qayerda saqlanmaydi. Uni foydalanuvchiga shaxsan yoki xavfsiz
            yo&apos;l bilan bering. Birinchi kirishda parolni almashtirish talab qilinadi.
          </Notice>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs text-slate-500">Login</p>
              <p className="font-mono text-base font-semibold text-slate-900">{creds.username}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Vaqtinchalik parol</p>
              <p className="flex items-center gap-2 font-mono text-lg font-semibold tracking-wider text-slate-900">
                <KeyRound className="h-4 w-4 text-slate-400" /> {creds.tempPassword}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={print}><Printer className="h-4 w-4" /> Chop etish</Button>
            <Button variant="outline" onClick={copy}><Copy className="h-4 w-4" /> Nusxa olish</Button>
            <Button onClick={onClose}>Tayyor</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
