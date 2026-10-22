import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { navFor } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/labels";
import { AppShell } from "@/components/layout/app-shell";
import { signOut } from "@/app/auth-actions";
import { getI18n } from "@/lib/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
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
      user={{ name: user.profile.full_name || user.profile.username || t("Foydalanuvchi"), roleLabel: t(ROLE_LABELS[user.profile.role]) }}
      orgName={settings?.kindergarten_name ?? t("Bog'cha")}
      unread={count ?? 0}
      signOut={signOut}
    >
      {children}
    </AppShell>
  );
}
