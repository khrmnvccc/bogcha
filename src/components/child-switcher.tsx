import Link from "next/link";
import { cn } from "@/lib/utils";

export function ChildSwitcher({ kids, active, base, extra = "" }: { kids: { id: string; full_name: string }[]; active: string; base: string; extra?: string }) {
  if (kids.length <= 1) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {kids.map((k) => (
        <Link key={k.id} href={`${base}?bola=${k.id}${extra}`}
          className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", k.id === active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>
          {k.full_name}
        </Link>
      ))}
    </div>
  );
}
