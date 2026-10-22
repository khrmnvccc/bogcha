import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Megaphone, Wallet, User } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { MarkAllRead } from "./mark-all";

export const metadata: Metadata = { title: "Bildirishnomalar" };
const ICON = { announcement: Megaphone, payment: Wallet, invoice: Wallet, account: User } as Record<string, typeof Bell>;

export default async function NotificationsPage() {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  const unread = (data ?? []).filter((n) => !n.is_read).length;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Bildirishnomalar" description={unread ? `${unread} ta o'qilmagan` : "Hammasi o'qilgan"} actions={unread > 0 && <MarkAllRead />} />
      <Card>
        {(data ?? []).length === 0 ? <EmptyState title="Bildirishnomalar yo'q" icon={<Bell className="h-6 w-6" />} /> : (
          <ul className="divide-y divide-slate-100">
            {(data ?? []).map((n) => {
              const Icon = ICON[n.kind] ?? Bell;
              const body = (
                <div className={cn("flex gap-3 px-5 py-4", !n.is_read && "bg-brand-50/50")}>
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", n.is_read ? "bg-slate-100 text-slate-500" : "bg-brand-100 text-brand-700")}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm text-slate-900", !n.is_read && "font-semibold")}>{n.title}</p>
                    {n.body && <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>}
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(n.created_at)}</p>
                  </div>
                </div>
              );
              return <li key={n.id}>{n.link?.startsWith("/") ? <Link href={n.link} className="block hover:bg-slate-50">{body}</Link> : body}</li>;
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
