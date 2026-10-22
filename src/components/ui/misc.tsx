import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, back }: {
  title: string; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
          <ChevronLeft className="h-4 w-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: {
  title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <p className="font-medium text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const statTones = {
  blue: "bg-brand-50 text-brand-600",
  green: "bg-mint-50 text-mint-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  gray: "bg-slate-100 text-slate-600",
  violet: "bg-violet-50 text-violet-600",
};

export function StatCard({ label, value, icon, tone = "blue", hint, href }: {
  label: string; value: React.ReactNode; icon: React.ReactNode; tone?: keyof typeof statTones; hint?: React.ReactNode; href?: string;
}) {
  const body = (
    <div className={cn("flex h-full items-start gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5", href && "transition hover:border-brand-200 hover:shadow-md")}>
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", statTones[tone])}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-0.5 text-xl font-semibold leading-tight tracking-tight text-slate-900 tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function Pagination({ page, pageSize, total, makeHref }: {
  page: number; pageSize: number; total: number; makeHref: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
      <span>
        Jami: {total} ta · {page}/{pages} sahifa
      </span>
      <div className="flex gap-2">
        <Link aria-disabled={page <= 1} href={makeHref(Math.max(1, page - 1))}
          className={cn("inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 hover:bg-slate-50", page <= 1 && "pointer-events-none opacity-40")}>
          <ChevronLeft className="h-4 w-4" /> Oldingi
        </Link>
        <Link aria-disabled={page >= pages} href={makeHref(Math.min(pages, page + 1))}
          className={cn("inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 hover:bg-slate-50", page >= pages && "pointer-events-none opacity-40")}>
          Keyingi <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900 sm:text-right">{children}</dd>
    </div>
  );
}

export function Notice({ tone = "blue", children, className }: { tone?: "blue" | "amber" | "red" | "green"; children: React.ReactNode; className?: string }) {
  const t = {
    blue: "border-brand-200 bg-brand-50 text-brand-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-800",
    green: "border-mint-100 bg-mint-50 text-mint-700",
  }[tone];
  return <div className={cn("rounded-lg border px-4 py-3 text-sm", t, className)}>{children}</div>;
}
