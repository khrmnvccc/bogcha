import type { Metadata } from "next";
import { requireUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AUDIT_ACTION, AUDIT_ENTITY } from "@/lib/labels";
import { addDaysISO, formatDateTime, todayISO, tashkentDateTimeToISO } from "@/lib/format";
import { rangeOf } from "@/lib/queries";
import { sp } from "@/lib/utils";
import { PageHeader, EmptyState, Pagination } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/ui/filter-bar";

export const metadata: Metadata = { title: "Audit jurnali" };
const PAGE = 50;
const HIDDEN = new Set(["id", "created_at", "updated_at", "recorded_at"]);

type Log = { id: number; action: string; entity: string; entity_id: string | null; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; reason: string | null; created_at: string; actor: { full_name: string; username: string | null } | null };

function show(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function Changes({ log }: { log: Log }) {
  const o = log.old_data ?? {};
  const n = log.new_data ?? {};
  const keys = log.action === "update"
    ? Object.keys(n).filter((k) => !HIDDEN.has(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k]))
    : Object.keys(log.action === "delete" ? o : n).filter((k) => !HIDDEN.has(k) && (log.action === "delete" ? o[k] : n[k]) != null);
  if (!keys.length) return null;
  return (
    <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[minmax(120px,auto)_1fr]">
      {keys.slice(0, 14).map((k) => (
        <div key={k} className="contents">
          <dt className="font-mono text-slate-500">{k}</dt>
          <dd className="break-all text-slate-700">
            {log.action === "update" ? <><span className="text-red-600 line-through">{show(o[k])}</span> → <span className="text-mint-700">{show(n[k])}</span></> : show(log.action === "delete" ? o[k] : n[k])}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser(ADMIN_ROLES);
  const params = await searchParams;
  const from = sp(params.dan) ?? addDaysISO(todayISO(), -7);
  const to = sp(params.gacha) ?? todayISO();
  const entity = sp(params.obyekt);
  const action = sp(params.amal);
  const page = Math.max(1, Number(sp(params.sahifa) ?? 1) || 1);
  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("id, action, entity, entity_id, old_data, new_data, reason, created_at, actor:actor_id(full_name, username)", { count: "exact" })
    .gte("created_at", tashkentDateTimeToISO(from, "00:00")).lt("created_at", tashkentDateTimeToISO(addDaysISO(to, 1), "00:00"))
    .order("created_at", { ascending: false }).range(...rangeOf(page, PAGE));
  if (entity) q = q.eq("entity", entity);
  if (action) q = q.eq("action", action);
  const { data, count } = await q;
  const logs = (data ?? []) as unknown as Log[];
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => typeof v === "string" && k !== "sahifa" && qs.set(k, v));

  return (
    <div>
      <PageHeader title="Audit jurnali" description="Muhim o'zgarishlar: kim, qachon, nima va nima sababdan o'zgartirgan. Jurnalni tahrirlab yoki o'chirib bo'lmaydi." />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <FilterBar filters={[
            { type: "date", name: "dan", label: "Dan" },
            { type: "date", name: "gacha", label: "Gacha" },
            { type: "select", name: "obyekt", label: "Bo'lim", options: Object.entries(AUDIT_ENTITY).map(([value, label]) => ({ value, label })) },
            { type: "select", name: "amal", label: "Amal", options: Object.entries(AUDIT_ACTION).map(([value, label]) => ({ value, label })) },
          ]} />
        </div>
        {logs.length === 0 ? <EmptyState title="Bu davrda yozuvlar yo'q" /> : (
          <>
            <ul className="divide-y divide-slate-100">
              {logs.map((l) => (
                <li key={l.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone={l.action === "delete" ? "red" : l.action === "insert" ? "green" : "blue"}>{AUDIT_ACTION[l.action] ?? l.action}</Badge>
                    <span className="font-medium text-slate-900">{AUDIT_ENTITY[l.entity] ?? l.entity}</span>
                    <span className="text-slate-500">· {l.actor ? `${l.actor.full_name} (${l.actor.username})` : "Tizim"}</span>
                    <span className="ml-auto text-xs text-slate-400">{formatDateTime(l.created_at)}</span>
                  </div>
                  {l.reason && <p className="mt-1 text-sm text-amber-800">Sabab: {l.reason}</p>}
                  <Changes log={l} />
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={PAGE} total={count ?? 0} makeHref={(n) => { const u = new URLSearchParams(qs); u.set("sahifa", String(n)); return `/audit?${u.toString()}`; }} />
          </>
        )}
      </Card>
    </div>
  );
}
