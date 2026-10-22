import * as React from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/labels";
import { T } from "@/lib/i18n/client";

const tones: Record<Tone, string> = {
  green: "bg-mint-50 text-mint-700 ring-mint-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  blue: "bg-brand-50 text-brand-700 ring-brand-600/20",
  gray: "bg-slate-100 text-slate-700 ring-slate-500/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

export function Badge({ tone = "gray", className, children, title }: {
  tone?: Tone; className?: string; children: React.ReactNode; title?: string;
}) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone], className)}>
      {typeof children === "string" ? <T>{children}</T> : children}
    </span>
  );
}

export function StatusBadge({ map, value }: { map: Record<string, { label: string; tone: Tone }>; value: string | null | undefined }) {
  if (!value || !map[value]) return <Badge>—</Badge>;
  return <Badge tone={map[value].tone}>{map[value].label}</Badge>;
}
