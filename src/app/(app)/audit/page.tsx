import type { Metadata } from "next";
import { requireUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AUDIT_ACTION, AUDIT_ENTITY } from "@/lib/labels";
import { addDaysISO, formatTime, todayISO, tashkentDateTimeToISO } from "@/lib/format";
import { fieldLabel, formatAuditValue, subjectIds } from "@/lib/audit-format";
import type { I18n } from "@/lib/i18n/core";
import { rangeOf } from "@/lib/queries";
import { cn, sp } from "@/lib/utils";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader, EmptyState, Pagination } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Audit jurnali") };
}
const PAGE = 50;

type Log = { id: number; action: string; entity: string; entity_id: string | null; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; reason: string | null; created_at: string; actor: { full_name: string; username: string | null } | null };
type Names = Record<"child" | "employee" | "guardian" | "group" | "profile", Map<string, string>>;

const ACTION_STYLE: Record<string, { icon: typeof Plus; cls: string }> = {
  insert: { icon: Plus, cls: "bg-mint-50 text-mint-700 ring-mint-600/20" },
  update: { icon: Pencil, cls: "bg-brand-50 text-brand-700 ring-brand-600/20" },
  delete: { icon: Trash2, cls: "bg-red-50 text-red-700 ring-red-600/20" },
};

function changedKeys(l: Log) {
  const o = l.old_data ?? {};
  const n = l.new_data ?? {};
  if (l.action === "update") return Object.keys(n).filter((k) => fieldLabel(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k]));
  const src = l.action === "delete" ? o : n;
  return Object.keys(src).filter((k) => fieldLabel(k) && src[k] != null && src[k] !== "" && !(Array.isArray(src[k]) && !(src[k] as unknown[]).length));
}

/** Who or what the entry is about, in words. */
function subjectOf(l: Log, names: Names): string | null {
  const d = { ...(l.old_data ?? {}), ...(l.new_data ?? {}) };
  const own = [d.full_name, d.name, d.title, d.receipt_number].find((v) => typeof v === "string" && v) as string | undefined;
  const ids = subjectIds(l.entity, d);
  const related = (ids.child && names.child.get(ids.child)) || (ids.employee && names.employee.get(ids.employee))
    || (ids.guardian && names.guardian.get(ids.guardian)) || (ids.profile && names.profile.get(ids.profile))
    || (ids.group && names.group.get(ids.group));
  if (own && related && own !== related) return `${related} · ${own}`;
  return own ?? related ?? null;
}

function Changes({ log, i18n }: { log: Log; i18n: Pick<I18n, "t" | "f"> }) {
  const { t } = i18n;
  const keys = changedKeys(log);
  if (!keys.length) return null;
  const o = log.old_data ?? {};
  const n = log.new_data ?? {};
  const val = (k: string, v: unknown) => formatAuditValue(log.entity, k, v, i18n);
  const rows = (
    <dl className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/60 text-xs">
      {keys.map((k) => (
        <div key={k} className="grid gap-0.5 px-3 py-1.5 sm:grid-cols-[minmax(140px,200px)_1fr] sm:gap-3">
          <dt className="text-slate-500">{t(fieldLabel(k))}</dt>
          <dd className="break-words text-slate-800">
            {log.action === "update"
              ? <><span className="text-slate-400 line-through">{val(k, o[k])}</span> <span className="text-slate-400">→</span> <span className="font-medium text-slate-900">{val(k, n[k])}</span></>
              : val(k, log.action === "delete" ? o[k] : n[k])}
          </dd>
        </div>
      ))}
    </dl>
  );
  if (log.action === "update" && keys.length <= 4) return rows;
  return (
    <details className="group mt-1">
      <summary className="cursor-pointer list-none text-xs font-medium text-brand-700 hover:underline">
        <span className="group-open:hidden">{t("Tafsilotlar ({0})", [keys.length])}</span>
        <span className="hidden group-open:inline">{t("Yashirish")}</span>
      </summary>
      {rows}
    </details>
  );
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, f } = await getI18n();
  await requireUser(ADMIN_ROLES);
  const params = await searchParams;
  const today = todayISO();
  const from = sp(params.dan) ?? addDaysISO(today, -7);
  const to = sp(params.gacha) ?? today;
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

  // Resolve the names behind ids so entries read "Aliyev Bekzod", not a UUID.
  const want = { child: new Set<string>(), employee: new Set<string>(), guardian: new Set<string>(), group: new Set<string>(), profile: new Set<string>() };
  for (const l of logs) {
    const ids = subjectIds(l.entity, { ...(l.old_data ?? {}), ...(l.new_data ?? {}) });
    (Object.keys(want) as (keyof typeof want)[]).forEach((k) => ids[k] && want[k].add(ids[k]!));
  }
  const fetchNames = async (table: string, col: string, ids: Set<string>) => {
    if (!ids.size) return new Map<string, string>();
    const { data: rows } = await supabase.from(table).select(`id, ${col}`).in("id", [...ids]);
    return new Map(((rows ?? []) as unknown as Record<string, string>[]).map((r) => [r.id, r[col]]));
  };
  const [child, employee, guardian, group, profile] = await Promise.all([
    fetchNames("children", "full_name", want.child), fetchNames("employees", "full_name", want.employee),
    fetchNames("guardians", "full_name", want.guardian), fetchNames("kg_groups", "name", want.group),
    fetchNames("profiles", "full_name", want.profile),
  ]);
  const names: Names = { child, employee, guardian, group, profile };

  const byDay = new Map<string, Log[]>();
  for (const l of logs) {
    const d = tashkentDay(l.created_at);
    byDay.set(d, [...(byDay.get(d) ?? []), l]);
  }
  const dayTitle = (d: string) => d === today ? t("Bugun") : d === addDaysISO(today, -1) ? t("Kecha") : `${f.weekdayName(d)}, ${f.formatDateLong(d)}`;

  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => typeof v === "string" && k !== "sahifa" && qs.set(k, v));

  return (
    <div>
      <PageHeader title={t("Audit jurnali")} description={t("Muhim o'zgarishlar: kim, qachon, nima va nima sababdan o'zgartirgan. Jurnalni tahrirlab yoki o'chirib bo'lmaydi.")} />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <FilterBar filters={[
            { type: "date", name: "dan", label: "Dan", default: from },
            { type: "date", name: "gacha", label: "Gacha", default: to },
            { type: "select", name: "obyekt", label: "Bo'lim", options: Object.entries(AUDIT_ENTITY).map(([value, label]) => ({ value, label })) },
            { type: "select", name: "amal", label: "Amal", options: Object.entries(AUDIT_ACTION).map(([value, label]) => ({ value, label })) },
          ]} />
        </div>
        {logs.length === 0 ? <EmptyState title={t("Bu davrda yozuvlar yo'q")} description={t("Sana oralig'ini yoki filtrlarni o'zgartiring")} /> : (
          <>
            {[...byDay.entries()].map(([day, items]) => (
              <section key={day}>
                <h3 className="sticky top-14 z-10 border-b border-slate-100 bg-slate-50/95 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur sm:top-16 sm:px-5">
                  {dayTitle(day)} <span className="font-normal normal-case text-slate-400">· {t("{0} ta yozuv", [items.length])}</span>
                </h3>
                <ul className="divide-y divide-slate-100">
                  {items.map((l) => {
                    const st = ACTION_STYLE[l.action] ?? ACTION_STYLE.update;
                    const Icon = st.icon;
                    const subject = subjectOf(l, names);
                    return (
                      <li key={l.id} className="flex gap-3 px-4 py-3 sm:px-5">
                        <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", st.cls)}><Icon className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <p className="text-sm text-slate-900">
                              <span className="font-medium">{t(AUDIT_ENTITY[l.entity] ?? l.entity)}</span>{" "}
                              <span className="text-slate-500">{t(AUDIT_ACTION[l.action] ?? l.action).toLowerCase()}</span>
                              {subject && <>: <span className="font-semibold">{subject}</span></>}
                            </p>
                            <span className="text-xs tabular-nums text-slate-400">{formatTime(l.created_at)}</span>
                          </div>
                          <p className="text-xs text-slate-500">{l.actor ? `${l.actor.full_name}${l.actor.username ? ` (@${l.actor.username})` : ""}` : t("Tizim (avtomatik)")}</p>
                          {l.reason && <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">{t("Sabab:")}{" "}{l.reason}</p>}
                          <Changes log={l} i18n={{ t, f }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <Pagination page={page} pageSize={PAGE} total={count ?? 0} makeHref={(n) => { const u = new URLSearchParams(qs); u.set("sahifa", String(n)); return `/audit?${u.toString()}`; }} />
          </>
        )}
      </Card>
    </div>
  );
}

function tashkentDay(iso: string) {
  return new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString().slice(0, 10);
}
