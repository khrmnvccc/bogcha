import { cn } from "@/lib/utils";

const SIZES = { xs: "h-7 w-7 text-[10px]", sm: "h-9 w-9 text-xs", md: "h-11 w-11 text-sm", lg: "h-20 w-20 text-2xl", xl: "h-28 w-28 text-3xl" } as const;
const TONES = [
  "bg-sky-100 text-sky-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700", "bg-teal-100 text-teal-700", "bg-orange-100 text-orange-700", "bg-indigo-100 text-indigo-700",
];

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function photoUrl(kind: "child" | "employee", id: string, version: string) {
  return `/api/rasm/${kind}/${id}?v=${encodeURIComponent(version)}`;
}

/** A person's photo, or coloured initials when there is none. */
export function Avatar({ kind, id, name, version, size = "sm", className }: {
  kind: "child" | "employee"; id: string; name: string; version?: string | null; size?: keyof typeof SIZES; className?: string;
}) {
  const tone = TONES[[...id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % TONES.length];
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ring-2 ring-white", SIZES[size], !version && tone, className)}>
      {version
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={photoUrl(kind, id, version)} alt={name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        : <span aria-hidden>{initials(name)}</span>}
    </span>
  );
}
