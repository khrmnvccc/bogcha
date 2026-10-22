"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { currentMonthISO } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";

type FilterDef =
  | { type: "search"; name: string; placeholder?: string }
  | { type: "select"; name: string; label: string; options: { value: string; label: string }[] }
  | { type: "date"; name: string; label: string; default?: string }
  | { type: "month"; name: string; label: string };

/** URL-driven filters: every change updates the query string (server re-renders). */
export function FilterBar({ filters, className }: { filters: FilterDef[]; className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [thisMonth] = React.useState(() => currentMonthISO().slice(0, 7));
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function update(name: string, value: string, debounce = false) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete("sahifa");
    const go = () => startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    if (timer.current) clearTimeout(timer.current);
    if (debounce) timer.current = setTimeout(go, 350);
    else go();
  }

  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center", pending && "opacity-70", className)}>
      {filters.map((f) => {
        if (f.type === "search") {
          const ph = t(f.placeholder ?? "Qidirish...");
          return (
            <div key={f.name} className="relative col-span-2 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                defaultValue={params.get(f.name) ?? ""}
                placeholder={ph}
                className="pl-9"
                onChange={(e) => update(f.name, e.target.value, true)}
                aria-label={ph}
              />
            </div>
          );
        }
        if (f.type === "select") {
          const label = t(f.label);
          return (
            <Select key={f.name} aria-label={label} value={params.get(f.name) ?? ""} onChange={(e) => update(f.name, e.target.value)}
              className="min-w-0 truncate sm:w-48">
              <option value="">{t("{0}: barchasi", [label])}</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
            </Select>
          );
        }
        const fallback = "default" in f ? f.default : f.type === "month" ? thisMonth : undefined;
        return (
          <label key={f.name} className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:gap-2 sm:text-sm sm:font-normal">
            <span className="shrink-0">{t(f.label)}</span>
            <Input type={f.type} value={params.get(f.name) ?? fallback ?? ""} onChange={(e) => update(f.name, e.target.value)} className="min-w-0 sm:w-44" />
          </label>
        );
      })}
    </div>
  );
}
