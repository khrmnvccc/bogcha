"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { savePhoto } from "@/lib/photo-actions";
import { useI18n } from "@/lib/i18n/client";
import { initials, photoUrl } from "@/components/avatar";

const SIDE = 480;

/** Crops the picture to a centred square and shrinks it to a small JPEG, so uploads stay light on mobile data. */
async function toSquareJpeg(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(SIDE, s);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

export function PhotoUpload({ kind, id, name, version, editable }: {
  kind: "child" | "employee"; id: string; name: string; version?: string | null; editable: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function run(data: string | null) {
    setBusy(true);
    try {
      const res = await savePhoto(kind, id, data);
      if (res.ok) { toast.success(res.message); router.refresh(); } else toast.error(res.message);
    } catch {
      toast.error(t("Rasmni o'qib bo'lmadi"));
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error(t("Faqat JPG, PNG yoki WebP rasm"));
    setBusy(true);
    let data: string;
    try { data = await toSquareJpeg(file); } catch { setBusy(false); return toast.error(t("Rasmni o'qib bo'lmadi")); }
    await run(data);
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <button type="button" disabled={!editable || busy} onClick={() => input.current?.click()}
        aria-label={editable ? t("Rasm yuklash") : name}
        className="group relative h-20 w-20 overflow-hidden rounded-full bg-gradient-to-br from-brand-100 to-mint-100 text-2xl font-semibold text-brand-700 ring-4 ring-white shadow-md sm:h-24 sm:w-24 disabled:cursor-default">
        {version
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={photoUrl(kind, id, version)} alt={name} className="h-full w-full object-cover" />
          : <span className="flex h-full w-full items-center justify-center">{initials(name)}</span>}
        {editable && (
          <span className={`absolute inset-0 flex items-center justify-center bg-slate-900/45 text-white transition ${busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
          </span>
        )}
        {editable && !busy && (
          <span className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-white group-hover:hidden">
            <Camera className="h-3.5 w-3.5" />
          </span>
        )}
      </button>
      {editable && version && (
        <button type="button" disabled={busy} onClick={() => run(null)} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600">
          <Trash2 className="h-3 w-3" />{t("O'chirish")}
        </button>
      )}
      {editable && <input ref={input} type="file" accept="image/*" className="hidden" onChange={onFile} />}
    </div>
  );
}
