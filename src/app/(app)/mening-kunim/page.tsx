import type { Metadata } from "next";
import { TelegramPrompt } from "@/components/telegram-prompt";
import Link from "next/link";
import { CalendarCheck, ChevronRight, Megaphone, Cake } from "lucide-react";
import { requireUser, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/queries";
import { formatDateLong, formatDateTime, todayISO, weekdayName } from "@/lib/format";
import { PageHeader, EmptyState, Notice } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { CheckWidget } from "@/components/check-widget";
import { checkIn, checkOut } from "../ishga-kelish/actions";

export const metadata: Metadata = { title: "Mening kunim" };

export default async function MyDayPage() {
  const user = await requireUser(STAFF_ROLES);
  const supabase = await createClient();
  const today = todayISO();
  const settings = await getSettings(supabase);

  const [{ data: emp }, { data: rec }, { data: groups }, { data: news }] = await Promise.all([
    user.employeeId ? supabase.from("employees").select("schedule_start, schedule_end").eq("id", user.employeeId).single() : Promise.resolve({ data: null }),
    user.employeeId ? supabase.from("employee_attendance").select("*").eq("employee_id", user.employeeId).eq("work_date", today).maybeSingle() : Promise.resolve({ data: null }),
    user.employeeId ? supabase.from("group_teachers").select("kg_groups(id, name, room, children(id, full_name, birth_date, status))").eq("employee_id", user.employeeId) : Promise.resolve({ data: [] }),
    supabase.from("announcements").select("id, title, body, created_at").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(3),
  ]);

  type G = { id: string; name: string; room: string | null; children: { id: string; full_name: string; birth_date: string; status: string }[] };
  const myGroups = ((groups ?? []) as unknown as { kg_groups: G | null }[]).map((g) => g.kg_groups).filter(Boolean) as G[];
  const childIds = myGroups.flatMap((g) => g.children.filter((c) => c.status === "active").map((c) => c.id));
  const { data: marked } = childIds.length
    ? await supabase.from("child_attendance").select("child_id, status").eq("date", today).in("child_id", childIds)
    : { data: [] };
  const markedSet = new Map((marked ?? []).map((m) => [m.child_id as string, m.status as string]));
  const mmdd = today.slice(5);
  const birthdays = myGroups.flatMap((g) => g.children).filter((c) => c.status === "active" && c.birth_date.slice(5) === mmdd);

  const schedule = `${(emp?.schedule_start ?? settings.work_start).slice(0, 5)} – ${(emp?.schedule_end ?? settings.work_end).slice(0, 5)}`;

  return (
    <div className="space-y-6">
      <PageHeader title={`Assalomu alaykum, ${user.profile.full_name.split(" ")[1] ?? user.profile.full_name}!`} description={`${weekdayName(today)}, ${formatDateLong(today)}`} />
      <TelegramPrompt linkedAt={user.profile.telegram_linked_at} />
      {user.employeeId ? (
        <CheckWidget record={rec} schedule={schedule} checkIn={checkIn} checkOut={checkOut}
          locationEnabled={settings.location_lat != null && settings.location_lng != null} />
      ) : (
        <Notice tone="amber">Hisobingiz xodim kartasiga bog&apos;lanmagan, shuning uchun ishga kelish-ketishni belgilay olmaysiz.</Notice>
      )}

      {birthdays.length > 0 && (
        <Notice tone="green" className="flex items-center gap-2">
          <Cake className="h-4 w-4" /> Bugun tug&apos;ilgan kun: {birthdays.map((b) => b.full_name).join(", ")} 🎉
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Guruhlarim" description="Bugungi davomat holati" action={<LinkButton href="/davomat" size="sm"><CalendarCheck className="h-4 w-4" /> Davomat belgilash</LinkButton>} />
          {myGroups.length === 0 ? <EmptyState title="Sizga hali guruh biriktirilmagan" /> : (
            <ul className="divide-y divide-slate-100">
              {myGroups.map((g) => {
                const active = g.children.filter((c) => c.status === "active");
                const done = active.filter((c) => markedSet.has(c.id)).length;
                const present = active.filter((c) => ["present", "late"].includes(markedSet.get(c.id) ?? "")).length;
                const pct = active.length ? Math.round((done / active.length) * 100) : 0;
                return (
                  <li key={g.id}>
                    <Link href={`/davomat?guruh=${g.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{g.name}{g.room && <span className="ml-2 text-xs text-slate-400">{g.room}</span>}</p>
                        <p className="text-sm text-slate-500">{active.length} bola · bugun kelgan: {present}</p>
                        <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-mint-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-sm text-slate-500">{done}/{active.length} belgilangan</span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="E'lonlar" action={<Link href="/elonlar" className="text-sm text-brand-700">Barchasi</Link>} />
          <CardBody className="space-y-4">
            {(news ?? []).length === 0 ? <p className="text-sm text-slate-500">Yangi e&apos;lonlar yo&apos;q</p> : (news ?? []).map((n) => (
              <div key={n.id} className="flex gap-3">
                <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  <p className="line-clamp-2 text-sm text-slate-500">{n.body}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(n.created_at)}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
