"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FilterDef =
  | { type: "search"; name: string; placeholder?: string }
  | { type: "select"; name: string; label: string; options: { value: string; label: string }[] }
  | { type: "date"; name: string; label: string; default?: string }
  | { type: "month"; name: string; label: string };

/** URL-driven filters: every change updates the query string (server re-renders). */
export function FilterBar({ filters, className }: { filters: FilterDef[]; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();
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
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", pending && "opacity-70", className)}>
      {filters.map((f) => {
        if (f.type === "search") {
          return (
            <div key={f.name} className="relative sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                defaultValue={params.get(f.name) ?? ""}
                placeholder={f.placeholder ?? "Qidirish..."}
                className="pl-9"
                onChange={(e) => update(f.name, e.target.value, true)}
                aria-label={f.placeholder ?? "Qidirish"}
              />
            </div>
          );
        }
        if (f.type === "select") {
          return (
            <Select key={f.name} aria-label={f.label} value={params.get(f.name) ?? ""} onChange={(e) => update(f.name, e.target.value)} className="sm:w-48">
              <option value="">{f.label}: barchasi</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          );
        }
        return (
          <label key={f.name} className="flex items-center gap-2 text-sm text-slate-500">
            <span className="shrink-0">{f.label}</span>
            <Input type={f.type} value={params.get(f.name) ?? ("default" in f ? f.default : undefined) ?? ""} onChange={(e) => update(f.name, e.target.value)} className="sm:w-44" />
          </label>
        );
      })}
    </div>
  );
}
