import type { Metadata } from "next";
import { requireUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { NewChildForm } from "../forms";

export const metadata: Metadata = { title: "Yangi bola" };

export default async function NewChildPage() {
  await requireUser(ADMIN_ROLES);
  const supabase = await createClient();
  const [{ data: groups }, { data: guardians }] = await Promise.all([
    supabase.from("kg_groups").select("id, name").eq("is_active", true).order("name"),
    supabase.from("guardians").select("id, full_name, phone").order("full_name"),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Yangi bola qo'shish" back={{ href: "/bolalar", label: "Bolalar" }} />
      <Card><CardBody><NewChildForm groups={groups ?? []} guardians={guardians ?? []} /></CardBody></Card>
    </div>
  );
}
