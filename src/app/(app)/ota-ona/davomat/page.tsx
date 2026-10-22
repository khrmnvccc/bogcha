import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyChildren } from "@/lib/parent";
import { ATTENDANCE_STATUS } from "@/lib/labels";
import { addMonthsISO, currentMonthISO, formatDate, formatMonth, todayISO, WEEKDAYS_SHORT } from "@/lib/format";
import { cn, sp } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ChildSwitcher } from "@/components/child-switcher";

export const metadata: Metadata = { title: "Davomat" };

const CELL: Record<string, string> = {
  present: "bg-mint-100 text-mint-700 ring-mint-200",
  late: "bg-amber-100 text-amber-800 ring-amber-200",
  absent: "bg-red-100 text-red-700 ring-red-200",
  excused: "bg-brand-100 text-brand-700 ring-brand-200",
};

export default async function ParentAttendance({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(["parent"]);
  const params = await searchParams;
  const supabase = await createClient();
  const kids = await getMyChildren(supabase, user.guardianId);
  if (!kids.length) return <div><PageHeader title="Davomat" /><Card><EmptyState title="Bog'langan bola yo'q" /></Card></div>;
  const child = kids.find((k) => k.id === sp(params.bola)) ?? kids[0];
  const oy = sp(params.oy);
  const month = oy && /^\d{4}-\d{2}$/.test(oy) ? `${oy}-01` : currentMonthISO();
  const today = todayISO();

  const { data } = await supabase.from("child_attendance").select("date, status, note").eq("child_id", child.id)
    .gte("date", month).lt("date", addMonthsISO(month, 1)).order("date");
  const recs = new Map((data ?? []).map((r) => [r.date as string, r]));
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const counts = Object.keys(ATTENDANCE_STATUS).map((k) => [k, (data ?? []).filter((r) => r.status === k).length] as const);
  const prev = addMonthsISO(month, -1).slice(0, 7);
  const next = addMonthsISO(month, 1).slice(0, 7);

  return (
    <div>
      <PageHeader title="Davomat" description={child.full_name} />
      <ChildSwitcher kids={kids} active={child.id} base="/ota-ona/davomat" />
      <Card>
        <CardHeader title={formatMonth(month)} action={<div className="flex gap-1">
          <Link href={`/ota-ona/davomat?bola=${child.id}&oy=${prev}`} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Oldingi oy"><ChevronLeft className="h-4 w-4" /></Link>
          {next <= currentMonthISO().slice(0, 7) && <Link href={`/ota-ona/davomat?bola=${child.id}&oy=${next}`} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Keyingi oy"><ChevronRight className="h-4 w-4" /></Link>}
        </div>} />
        <CardBody>
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
            {counts.map(([k, n]) => <span key={k} className={cn("rounded-full px-3 py-1 ring-1", CELL[k])}>{ATTENDANCE_STATUS[k].label}: <b>{n}</b></span>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs sm:gap-2">
            {WEEKDAYS_SHORT.map((d) => <div key={d} className="py-1 font-medium text-slate-400">{d}</div>)}
            {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: days }).map((_, i) => {
              const date = `${month.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
              const r = recs.get(date);
              return (
                <div key={date} title={r ? `${ATTENDANCE_STATUS[r.status].label}${r.note ? ": " + r.note : ""}` : undefined}
                  className={cn("flex aspect-square flex-col items-center justify-center rounded-lg ring-1 ring-inset sm:text-sm",
                    r ? CELL[r.status] : date > today ? "text-slate-300 ring-slate-100" : "bg-slate-50 text-slate-500 ring-slate-100",
                    date === today && "outline outline-2 outline-brand-500")}>
                  <span className="font-medium">{i + 1}</span>
                  {r && <span className="hidden text-[10px] sm:block">{ATTENDANCE_STATUS[r.status].label}</span>}
                </div>
              );
            })}
          </div>
        </CardBody>
        {(data ?? []).some((r) => r.note) && (
          <div className="border-t border-slate-100 px-5 py-4">
            <p className="mb-2 text-sm font-medium text-slate-700">Izohlar</p>
            <ul className="space-y-1 text-sm">
              {(data ?? []).filter((r) => r.note).map((r) => <li key={r.date}>{formatDate(r.date)} · <StatusBadge map={ATTENDANCE_STATUS} value={r.status} /> {r.note}</li>)}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
