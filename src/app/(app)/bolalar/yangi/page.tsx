import type { Metadata } from "next";
import { requireUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { NewChildForm } from "../forms";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Yangi bola") };
}

export default async function NewChildPage() {
  const { t } = await getI18n();
  await requireUser(ADMIN_ROLES);
  const supabase = await createClient();
  const [{ data: groups }, { data: guardians }] = await Promise.all([
    supabase.from("kg_groups").select("id, name").eq("is_active", true).order("name"),
    supabase.from("guardians").select("id, full_name, phone").order("full_name"),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("Yangi bola qo'shish")} back={{ href: "/bolalar", label: "Bolalar" }} />
      <Card><CardBody><NewChildForm groups={groups ?? []} guardians={guardians ?? []} /></CardBody></Card>
    </div>
  );
}
