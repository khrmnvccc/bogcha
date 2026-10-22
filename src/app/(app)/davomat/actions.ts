"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { authorize, isUser, dbErrorMessage, type ActionState } from "@/lib/actions";
import { zDate } from "@/lib/validation";
import { todayISO } from "@/lib/format";

const itemsSchema = z.array(z.object({
  child_id: z.string().uuid(),
  status: z.enum(["present", "absent", "late", "excused"]),
  note: z.string().trim().max(500).optional().nullable(),
})).min(1, "Hech bir bola belgilanmagan").max(500);

export async function saveChildAttendance(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await authorize(["director", "admin", "teacher"]);
  if (!isUser(user)) return user;
  const date = zDate("Sana").safeParse(fd.get("date"));
  if (!date.success) return { ok: false, message: "Sana noto'g'ri" };
  if (date.data > todayISO()) return { ok: false, message: "Kelajakdagi sana uchun davomat belgilab bo'lmaydi" };
  let items: unknown;
  try {
    items = JSON.parse(String(fd.get("items") ?? "[]"));
  } catch {
    return { ok: false, message: "Noto'g'ri ma'lumot" };
  }
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Noto'g'ri ma'lumot" };
  const reason = String(fd.get("reason") ?? "").trim();
  if (date.data < todayISO() && reason.length < 5) {
    return { ok: false, message: "O'tgan kun davomatini o'zgartirish uchun sabab yozing (kamida 5 belgi)", errors: { reason: ["Sabab yozing"] } };
  }
  const supabase = await createClient();
  // Authorization per child (own group, today only unless permitted) is enforced inside the database function.
  const { data, error } = await supabase.rpc("save_child_attendance", { p_date: date.data, p_items: parsed.data, p_reason: reason || null });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath("/davomat");
  revalidatePath("/panel");
  return { ok: true, message: `${data} ta bola uchun davomat saqlandi` };
}
