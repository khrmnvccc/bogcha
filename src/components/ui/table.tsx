import * as React from "react";
import { cn } from "@/lib/utils";
import { ResponsiveTable } from "./responsive-table";

/** Data table; on phones rows turn into cards unless `stack` is false (then it scrolls sideways). */
export function Table({ className, children, stack = true }: { className?: string; children: React.ReactNode; stack?: boolean }) {
  if (!stack) {
    return (
      <div className={cn("w-full overflow-x-auto", className)}>
        <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
      </div>
    );
  }
  return (
    <ResponsiveTable className={cn("rtable w-full sm:overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm sm:min-w-[640px]">{children}</table>
    </ResponsiveTable>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-slate-50/80 text-left text-xs font-medium uppercase tracking-wide text-slate-500">{children}</thead>;
}

export function TH({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <th className={cn("whitespace-nowrap px-4 py-3 font-medium", className)}>{children}</th>;
}

export function TR({ className, children }: { className?: string; children: React.ReactNode }) {
  return <tr className={cn("border-t border-slate-100 hover:bg-slate-50/60", className)}>{children}</tr>;
}

export function TD({ className, children, colSpan }: { className?: string; children?: React.ReactNode; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn("px-4 py-3 align-middle text-slate-700", className)}>{children}</td>;
}
