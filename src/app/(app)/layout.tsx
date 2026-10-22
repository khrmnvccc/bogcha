import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { navFor } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/labels";
import { AppShell } from "@/components/layout/app-shell";
import { signOut } from "@/app/auth-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.profile.must_change_password) redirect("/parol-almashtirish");

  const supabase = await createClient();
  const [{ data: settings }, { count }] = await Promise.all([
    supabase.from("settings").select("kindergarten_name").eq("id", 1).maybeSingle(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
  ]);

  return (
    <AppShell
      nav={navFor(user)}
      user={{ name: user.profile.full_name || user.profile.username || "Foydalanuvchi", roleLabel: ROLE_LABELS[user.profile.role] }}
      orgName={settings?.kindergarten_name ?? "Bog'cha"}
      unread={count ?? 0}
      signOut={signOut}
    >
      {children}
    </AppShell>
  );
}
