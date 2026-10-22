import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, ShieldAlert, Wallet } from "lucide-react";
import { requireUser, STAFF_ROLES, ADMIN_ROLES, canViewFinance, hasPermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ATTENDANCE_STATUS, CHILD_STATUS, INVOICE_STATUS, NOTE_CATEGORY, PAYMENT_METHOD } from "@/lib/labels";
import { addDaysISO, ageFromBirth, formatDate, formatDateTime, formatMonth, formatSom, todayISO } from "@/lib/format";
import { suggestUsername } from "@/lib/accounts";
import { PageHeader, InfoRow, EmptyState } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { LinkButton } from "@/components/ui/button";
import { AccountActions } from "@/components/account-actions";
import { resetPassword, setUserActive } from "../../xodimlar/actions";
import { EditChild, AddGuardian, EditGuardian, UnlinkGuardian, ParentAccountButton, AddPickup, RemovePickup, AddNote, DeleteNote } from "./client";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Bola profili") };
}

type Guardian = {
  relationship: string; is_primary: boolean; can_pickup: boolean;
  guardians: { id: string; full_name: string; phone: string; phone2: string | null; address: string | null; workplace: string | null; telegram_chat_id: string | null;
    profile_id: string | null; profiles: { username: string; is_active: boolean; must_change_password: boolean } | null } | null;
};

export default async function ChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, f } = await getI18n();
  const user = await requireUser(STAFF_ROLES);
  const isAdmin = ADMIN_ROLES.includes(user.profile.role);
  const finance = canViewFinance(user);
  const { id } = await params;
  const supabase = await createClient();
  const today = todayISO();

  const { data: c } = await supabase.from("children")
    .select("*, kg_groups(id, name, monthly_fee), child_guardians(relationship, is_primary, can_pickup, guardians(id, full_name, phone, phone2, address, workplace, telegram_chat_id, profile_id, profiles(username, is_active, must_change_password)))")
    .eq("id", id).maybeSingle();
  if (!c) notFound();

  const [{ data: pickups }, { data: notes }, { data: att }, { data: invoices }, { data: payments }, { data: groups }, { data: allGuardians }, { data: settings }] = await Promise.all([
    supabase.from("pickup_contacts").select("*").eq("child_id", id).order("created_at"),
    supabase.from("child_notes").select("id, category, body, created_at, profiles:created_by(full_name)").eq("child_id", id).order("created_at", { ascending: false }),
    supabase.from("child_attendance").select("date, status, note, recorded_at, profiles:updated_by(full_name)").eq("child_id", id).gte("date", addDaysISO(today, -60)).order("date", { ascending: false }),
    finance ? supabase.from("invoices").select("*").eq("child_id", id).order("period", { ascending: false }).limit(12) : Promise.resolve({ data: [] }),
    finance ? supabase.from("payments").select("id, amount, method, paid_on, receipt_number, is_void, invoices(period)").eq("child_id", id).order("paid_on", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    isAdmin ? supabase.from("kg_groups").select("id, name").eq("is_active", true).order("name") : Promise.resolve({ data: [] }),
    isAdmin ? supabase.from("guardians").select("id, full_name, phone").order("full_name") : Promise.resolve({ data: [] }),
    supabase.from("settings").select("default_monthly_fee").eq("id", 1).single(),
  ]);

  const guardians = (c.child_guardians as unknown as Guardian[]).filter((g) => g.guardians);
  const group = c.kg_groups as { id: string; name: string; monthly_fee: number | null } | null;
  const fee = c.monthly_fee ?? group?.monthly_fee ?? settings?.default_monthly_fee ?? 0;
  const attRows = (att ?? []) as unknown as { date: string; status: string; note: string | null; recorded_at: string; profiles: { full_name: string } | null }[];
  const counts = Object.fromEntries(Object.keys(ATTENDANCE_STATUS).map((k) => [k, attRows.filter((a) => a.status === k).length]));
  const totalDebt = (invoices ?? []).reduce((s, i) => s + Math.max(0, Number(i.balance)), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={c.full_name} description={`${f.ageFromBirth(c.birth_date)} · ${group?.name ?? "Guruhsiz"}`} back={{ href: "/bolalar", label: "Bolalar" }}
        actions={<>
          {finance && <LinkButton variant="outline" href={`/tolovlar?bola=${c.id}`}><Wallet className="h-4 w-4" />{" "}{t("To'lovlar")}</LinkButton>}
          {isAdmin && <EditChild groups={groups ?? []} child={c} />}
        </>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t("Asosiy ma'lumotlar")} />
            <CardBody>
              <dl className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
                <InfoRow label={t("Tug'ilgan sana")}>{formatDate(c.birth_date)}</InfoRow>
                <InfoRow label={t("Jinsi")}>{c.gender === "male" ? t("O'g'il") : c.gender === "female" ? t("Qiz") : "—"}</InfoRow>
                <InfoRow label={t("Guruh")}>{group ? <Link className="text-brand-700" href={`/guruhlar/${group.id}`}>{group.name}</Link> : "—"}</InfoRow>
                <InfoRow label={t("Holati")}><StatusBadge map={CHILD_STATUS} value={c.status} /></InfoRow>
                <InfoRow label={t("Qabul qilingan")}>{formatDate(c.enrollment_date)}</InfoRow>
                {c.leave_date && <InfoRow label={t("Ketgan sana")}>{formatDate(c.leave_date)}</InfoRow>}
                {finance && <InfoRow label={t("Oylik to'lov")}>{f.formatSom(fee)}{c.monthly_fee == null && <span className="ml-1 text-xs text-slate-400">({group?.monthly_fee != null ? "guruh" : "umumiy"})</span>}</InfoRow>}
                {finance && <InfoRow label={t("Joriy qarz")}>{totalDebt > 0 ? <span className="text-red-600">{f.formatSom(totalDebt)}</span> : <Badge tone="green">{t("Qarz yo'q")}</Badge>}</InfoRow>}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("Ota-onalar / vasiylar")} action={isAdmin && <AddGuardian childId={c.id} guardians={allGuardians ?? []} />} />
            {guardians.length === 0 ? <EmptyState title={t("Ota-ona bog'lanmagan")} /> : (
              <ul className="divide-y divide-slate-100">
                {guardians.map(({ guardians: g, relationship, is_primary, can_pickup }) => g && (
                  <li key={g.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-slate-900">
                        {g.full_name} <span className="text-sm font-normal text-slate-500">· {relationship}</span>
                        {is_primary && <Badge tone="blue" className="ml-2">{t("Asosiy")}</Badge>}
                        {can_pickup && <Badge tone="green" className="ml-1">{t("Olib keta oladi")}</Badge>}
                      </p>
                      <p className="flex flex-wrap gap-x-4 text-sm">
                        <a href={`tel:${g.phone}`} className="inline-flex items-center gap-1 text-brand-700"><Phone className="h-3.5 w-3.5" />{g.phone}</a>
                        {g.phone2 && <a href={`tel:${g.phone2}`} className="text-brand-700">{g.phone2}</a>}
                      </p>
                      {(g.address || g.workplace) && <p className="text-sm text-slate-500">{[g.address, g.workplace].filter(Boolean).join(" · ")}</p>}
                      {isAdmin && (
                        <div className="pt-1 text-sm">
                          {g.profiles ? (
                            <div className="space-y-2">
                              <p className="text-slate-600">{t("Kabinet:")}{" "}<span className="font-mono">{g.profiles.username}</span>
                                {!g.profiles.is_active && <Badge tone="red" className="ml-1">{t("bloklangan")}</Badge>}
                                {g.profiles.must_change_password && <Badge tone="amber" className="ml-1">{t("hali kirmagan")}</Badge>}</p>
                              <AccountActions profileId={g.profile_id!} isActive={g.profiles.is_active} resetAction={resetPassword} activeAction={setUserActive} />
                            </div>
                          ) : <ParentAccountButton guardianId={g.id} suggested={suggestUsername(g.full_name)} />}
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex shrink-0">
                        <EditGuardian childId={c.id} g={{ ...g, relationship, can_pickup }} />
                        <UnlinkGuardian childId={c.id} guardianId={g.id} name={g.full_name} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t("Davomat")} description={t("Oxirgi 60 kun: keldi {0}, kechikdi {1}, kelmagan {2}, sababli {3}", [counts.present, counts.late, counts.absent, counts.excused])} />
            {attRows.length === 0 ? <EmptyState title={t("Davomat yozuvlari yo'q")} /> : (
              <Table>
                <THead><tr><TH>{t("Sana")}</TH><TH>{t("Holat")}</TH><TH>{t("Izoh")}</TH><TH>{t("Kim belgiladi")}</TH></tr></THead>
                <tbody>
                  {attRows.slice(0, 30).map((a) => (
                    <TR key={a.date}>
                      <TD>{formatDate(a.date)}</TD>
                      <TD><StatusBadge map={ATTENDANCE_STATUS} value={a.status} /></TD>
                      <TD className="text-slate-500">{a.note ?? "—"}</TD>
                      <TD className="text-xs text-slate-500">{a.profiles?.full_name ?? "—"}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          {finance && (
            <Card>
              <CardHeader title={t("To'lovlar")} action={<LinkButton size="sm" href={`/tolovlar?bola=${c.id}`}>{t("To'lov qabul qilish")}</LinkButton>} />
              {(invoices ?? []).length === 0 ? <EmptyState title={t("Hisoblar hali yaratilmagan")} /> : (
                <Table>
                  <THead><tr><TH>{t("Oy")}</TH><TH className="text-right">{t("Hisoblangan")}</TH><TH className="text-right">{t("To'langan")}</TH><TH className="text-right">{t("Qoldiq")}</TH><TH>{t("Holat")}</TH></tr></THead>
                  <tbody>
                    {(invoices ?? []).map((i) => (
                      <TR key={i.id}>
                        <TD>{f.formatMonth(i.period)}</TD>
                        <TD className="text-right">{f.formatSom(i.amount_due)}</TD>
                        <TD className="text-right">{f.formatSom(i.paid_total)}</TD>
                        <TD className="text-right font-medium">{f.formatSom(i.balance)}</TD>
                        <TD><StatusBadge map={INVOICE_STATUS} value={i.status} /></TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
              {(payments ?? []).length > 0 && (
                <div className="border-t border-slate-100 px-5 py-4">
                  <p className="mb-2 text-sm font-medium text-slate-700">{t("To'lovlar tarixi")}</p>
                  <ul className="space-y-1.5 text-sm">
                    {((payments ?? []) as unknown as { id: string; amount: number; method: string; paid_on: string; receipt_number: string; is_void: boolean; invoices: { period: string } | null }[]).map((p) => (
                      <li key={p.id} className={`flex justify-between gap-3 ${p.is_void ? "text-slate-400 line-through" : ""}`}>
                        <span>{formatDate(p.paid_on)} · {f.formatMonth(p.invoices?.period)} · {t(PAYMENT_METHOD[p.method])} · {p.receipt_number}</span>
                        <span className="font-medium">{f.formatSom(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("Olib ketuvchilar")} description={t("Ruxsat berilgan shaxslar")} action={isAdmin && <AddPickup childId={c.id} />} />
            <CardBody className="space-y-3">
              {guardians.filter((g) => g.can_pickup).map(({ guardians: g, relationship }) => g && (
                <div key={g.id} className="text-sm"><p className="font-medium text-slate-900">{g.full_name} <span className="font-normal text-slate-500">({relationship})</span></p><a className="text-brand-700" href={`tel:${g.phone}`}>{g.phone}</a></div>
              ))}
              {(pickups ?? []).map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-2 text-sm">
                  <div><p className="font-medium text-slate-900">{p.full_name} <span className="font-normal text-slate-500">({p.relationship})</span></p><a className="text-brand-700" href={`tel:${p.phone}`}>{p.phone}</a></div>
                  {isAdmin && <RemovePickup id={p.id} childId={c.id} />}
                </div>
              ))}
              {guardians.filter((g) => g.can_pickup).length + (pickups ?? []).length === 0 && <p className="text-sm text-slate-500">{t("Hech kim ko'rsatilmagan")}</p>}
            </CardBody>
          </Card>

          {user.profile.role !== "accountant" && (
            <Card>
              <CardHeader title={t("Maxfiy izohlar")} description={t("Faqat xodimlar uchun")} action={<AddNote childId={c.id} canSensitive={hasPermission(user, "children.view_notes")} />} />
              <CardBody className="space-y-4">
                {(notes ?? []).length === 0 ? <p className="flex items-center gap-2 text-sm text-slate-500"><ShieldAlert className="h-4 w-4" />{t("Izohlar yo'q yoki ko'rishga ruxsat yo'q")}</p> :
                  ((notes ?? []) as unknown as { id: string; category: string; body: string; created_at: string; profiles: { full_name: string } | null }[]).map((n) => (
                    <div key={n.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <Badge tone={n.category === "allergy" || n.category === "medical" ? "red" : "gray"}>{t(NOTE_CATEGORY[n.category])}</Badge>
                        {isAdmin && <DeleteNote id={n.id} childId={c.id} />}
                      </div>
                      <p className="mt-2 whitespace-pre-line text-sm text-slate-800">{n.body}</p>
                      <p className="mt-1 text-xs text-slate-400">{n.profiles?.full_name ?? ""} · {formatDateTime(n.created_at)}</p>
                    </div>
                  ))}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
