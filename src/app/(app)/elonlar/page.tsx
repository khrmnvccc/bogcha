import type { Metadata } from "next";
import { Pin, Megaphone } from "lucide-react";
import { requireUser, ADMIN_ROLES, hasPermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AUDIENCE_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Composer, DeleteAnnouncement } from "./composer";

export const metadata: Metadata = { title: "E'lonlar" };

type A = { id: string; title: string; body: string; audience: string; is_pinned: boolean; created_at: string; created_by: string | null;
  kg_groups: { name: string } | null; guardians: { full_name: string } | null; author: { full_name: string } | null };

export default async function AnnouncementsPage() {
  const user = await requireUser();
  const isAdmin = ADMIN_ROLES.includes(user.profile.role);
  const canPublish = user.profile.role !== "parent" && hasPermission(user, "announcements.publish");
  const supabase = await createClient();
  const isStaff = user.profile.role !== "parent";

  let groupsQ = supabase.from("kg_groups").select("id, name").eq("is_active", true).order("name");
  if (canPublish && !isAdmin) {
    const { data: mine } = await supabase.from("group_teachers").select("group_id").eq("employee_id", user.employeeId ?? "00000000-0000-0000-0000-000000000000");
    groupsQ = groupsQ.in("id", (mine ?? []).map((m) => m.group_id));
  }
  const [{ data }, { data: groups }, { data: guardians }] = await Promise.all([
    supabase.from("announcements").select(`id, title, body, audience, is_pinned, created_at, created_by, kg_groups(name), guardians(full_name)${isStaff ? ", author:created_by(full_name)" : ""}`)
      .order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(100),
    canPublish ? groupsQ : Promise.resolve({ data: [] }),
    isAdmin ? supabase.from("guardians").select("id, full_name, phone").order("full_name") : Promise.resolve({ data: [] }),
  ]);
  const items = (data ?? []) as unknown as A[];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="E'lonlar" description="Bog'cha yangiliklari va muhim xabarlar"
        actions={canPublish && <Composer groups={groups ?? []} guardians={guardians ?? []} isAdmin={isAdmin} />} />
      {items.length === 0 ? <Card><EmptyState title="Hozircha e'lonlar yo'q" icon={<Megaphone className="h-6 w-6" />} /></Card> : (
        <div className="space-y-4">
          {items.map((a) => (
            <Card key={a.id} className={a.is_pinned ? "border-brand-200 ring-1 ring-brand-100" : undefined}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                      {a.is_pinned && <Pin className="h-4 w-4 text-brand-600" />}{a.title}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDateTime(a.created_at)}{isStaff && a.author ? ` · ${a.author.full_name}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {isStaff && <Badge tone="blue">{a.audience === "group" ? `Guruh: ${a.kg_groups?.name ?? ""}` : a.audience === "guardian" ? `Ota-ona: ${a.guardians?.full_name ?? ""}` : AUDIENCE_LABELS[a.audience]}</Badge>}
                    {(isAdmin || a.created_by === user.id) && <DeleteAnnouncement id={a.id} />}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{a.body}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
