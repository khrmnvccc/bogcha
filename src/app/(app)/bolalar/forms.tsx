"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Field, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Input, Select } from "@/components/ui/input";
import { CredentialsDialog, type Credentials } from "@/components/credentials";
import { todayISO } from "@/lib/format";
import { createChild } from "./actions";
import { useI18n } from "@/lib/i18n/client";

export type ChildValues = {
  id?: string; full_name?: string; birth_date?: string; gender?: string | null; group_id?: string | null;
  enrollment_date?: string; leave_date?: string | null; status?: string; monthly_fee?: number | null;
};

export function ChildFields({ v = {}, groups }: { v?: ChildValues; groups: { id: string; name: string }[] }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <Field name="full_name" label={t("F.I.Sh.")} required className="sm:col-span-2">
        <Input defaultValue={v.full_name} placeholder={t("Rahimov Sardor Akmal o'g'li")} />
      </Field>
      <Field name="birth_date" label={t("Tug'ilgan sana")} required>
        <Input type="date" max={todayISO()} defaultValue={v.birth_date} />
      </Field>
      <Field name="gender" label={t("Jinsi")}>
        <Select defaultValue={v.gender ?? ""}>
          <option value="">—</option>
          <option value="male">{t("O'g'il bola")}</option>
          <option value="female">{t("Qiz bola")}</option>
        </Select>
      </Field>
      <Field name="group_id" label={t("Guruh")}>
        <Select defaultValue={v.group_id ?? ""}>
          <option value="">{t("Guruhsiz")}</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
      </Field>
      <Field name="enrollment_date" label={t("Qabul qilingan sana")} required>
        <Input type="date" defaultValue={v.enrollment_date ?? todayISO()} />
      </Field>
      <Field name="status" label={t("Holati")} required>
        <Select defaultValue={v.status ?? "active"}>
          <option value="active">{t("Faol")}</option>
          <option value="paused">{t("To'xtatilgan")}</option>
          <option value="left">{t("Ketgan")}</option>
          <option value="graduated">{t("Bitirgan")}</option>
        </Select>
      </Field>
      {v.id && (
        <Field name="leave_date" label={t("Ketgan sana")}>
          <Input type="date" defaultValue={v.leave_date ?? ""} />
        </Field>
      )}
      <Field name="monthly_fee" label={t("Shaxsiy oylik to'lov (so'm)")} hint={t("Bo'sh qolsa, guruh yoki umumiy summa olinadi")}>
        <Input inputMode="numeric" defaultValue={v.monthly_fee ?? ""} placeholder={t("masalan: 1 000 000")} />
      </Field>
    </div>
  );
}

export function GuardianFields({ v = {} }: { v?: { full_name?: string; relationship?: string; phone?: string; phone2?: string | null; address?: string | null; workplace?: string | null } }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="g_full_name" label={t("F.I.Sh.")} required><Input defaultValue={v.full_name ?? ""} /></Field>
      <Field name="g_relationship" label={t("Qarindoshligi")} required>
        <Input defaultValue={v.relationship ?? t("Ona")} list="relationships" />
      </Field>
      <datalist id="relationships">{["Ona", "Ota", "Buvi", "Bobo", "Opa", "Aka", "Vasiy"].map((r) => <option key={r} value={t(r)} />)}</datalist>
      <Field name="g_phone" label={t("Telefon")} required><Input type="tel" inputMode="tel" defaultValue={v.phone ?? ""} placeholder="+998 90 123 45 67" /></Field>
      <Field name="g_phone2" label={t("Qo'shimcha telefon")}><Input type="tel" inputMode="tel" defaultValue={v.phone2 ?? ""} /></Field>
      <Field name="g_address" label={t("Manzil")} className="sm:col-span-2"><Input defaultValue={v.address ?? ""} /></Field>
      <Field name="g_workplace" label={t("Ish joyi")} className="sm:col-span-2"><Input defaultValue={v.workplace ?? ""} /></Field>
    </div>
  );
}

export function GuardianPicker({ guardians, allowNone = false, children }: {
  guardians: { id: string; full_name: string; phone: string }[]; allowNone?: boolean; children?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [mode, setMode] = React.useState<"new" | "existing" | "none">("new");
  return (
    <div className="space-y-4">
      <input type="hidden" name="guardian_mode" value={mode} />
      <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
        {([["new", "Yangi ota-ona"], ["existing", "Mavjud ota-ona"], ...(allowNone ? [["none", "Keyinroq"]] : [])] as [typeof mode, string][]).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setMode(k)}
            className={`rounded-md px-3 py-1.5 font-medium ${mode === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{t(l)}</button>
        ))}
      </div>
      {mode === "new" && <GuardianFields />}
      {mode === "new" && children}
      {mode === "existing" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="existing_guardian_id" label={t("Ota-ona")} required hint={t("Aka-uka/opa-singillar uchun bitta ota-ona yetarli")}>
            <Select defaultValue="">
              <option value="">{t("Tanlang")}</option>
              {guardians.map((g) => <option key={g.id} value={g.id}>{g.full_name} · {g.phone}</option>)}
            </Select>
          </Field>
          <Field name="e_relationship" label={t("Qarindoshligi")} required><Input defaultValue={t("Ona")} list="relationships" /></Field>
        </div>
      )}
    </div>
  );
}

export function NewChildForm({ groups, guardians }: { groups: { id: string; name: string }[]; guardians: { id: string; full_name: string; phone: string }[] }) {
  const { t } = useI18n();
  const [creds, setCreds] = React.useState<Credentials | null>(null);
  const [account, setAccount] = React.useState(true);
  const [newId, setNewId] = React.useState<string | null>(null);
  const router = useRouter();
  return (
    <>
      <ActionForm action={createChild} className="space-y-8" onSuccess={(s) => {
        const id = s.data?.id as string;
        if (s.data?.creds) { setNewId(id); setCreds(s.data.creds as Credentials); }
        else router.push(`/bolalar/${id}`);
      }}>
        <section>
          <h2 className="mb-4 text-base font-semibold text-slate-900">{t("Bola ma'lumotlari")}</h2>
          <ChildFields groups={groups} />
        </section>
        <section>
          <h2 className="mb-4 text-base font-semibold text-slate-900">{t("Ota-ona yoki vasiy")}</h2>
          <GuardianPicker guardians={guardians} allowNone>
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <input type="checkbox" name="create_parent_account" checked={account} onChange={(e) => setAccount(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />{t("Ota-ona uchun shaxsiy kabinet (login) yaratish")}</label>
              {account && (
                <Field name="parent_username" label={t("Login")} required hint={t("Masalan: rahimova.dilnoza")}>
                  <Input autoCapitalize="none" spellCheck={false} />
                </Field>
              )}
            </div>
          </GuardianPicker>
        </section>
        <div className="flex justify-end"><SubmitButton size="lg">{t("Saqlash")}</SubmitButton></div>
      </ActionForm>
      <CredentialsDialog creds={creds} onClose={() => { setCreds(null); if (newId) router.push(`/bolalar/${newId}`); }} />
    </>
  );
}
