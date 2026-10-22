import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayISO } from "@/lib/format";

export type Settings = {
  kindergarten_name: string; address: string | null; phone: string | null; phone2: string | null;
  email: string | null; telegram: string | null; working_hours_text: string | null;
  default_monthly_fee: number; billing_due_day: number; work_start: string; work_end: string;
  work_days: number[]; late_grace_minutes: number; early_leave_grace_minutes: number;
  min_shift_minutes: number; max_shift_minutes: number; location_lat: number | null; location_lng: number | null;
  location_radius_m: number; child_attendance_cutoff: string | null;
};

export async function getSettings(supabase: SupabaseClient): Promise<Settings> {
  const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
  return data as Settings;
}

/** ISO weekday (1 = Monday ... 7 = Sunday) of a YYYY-MM-DD date. */
export function isoDow(dateISO: string): number {
  const d = new Date(`${dateISO}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export type EmployeeLite = {
  id: string; full_name: string; position: string; status: string;
  schedule_start: string | null; schedule_end: string | null; work_days: number[] | null; profile_id: string | null;
};

export function isExpectedOn(e: EmployeeLite, s: Settings, dateISO = todayISO()): boolean {
  if (e.status !== "active") return false;
  return (e.work_days ?? s.work_days).includes(isoDow(dateISO));
}

export function rangeOf(page: number, size: number): [number, number] {
  const from = (page - 1) * size;
  return [from, from + size - 1];
}
