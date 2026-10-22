import "server-only";
import { z } from "zod";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import type { Role } from "@/lib/labels";

export type ActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
  data?: Record<string, unknown>;
};

export const initialState: ActionState = {};

type PgLikeError = { code?: string; message?: string } | null | undefined;

const ENGLISH_PG = /duplicate key|violates|null value|invalid input|syntax|does not exist|permission denied|row-level security|out of range|JWT/i;

/** Turns a database error into a safe Uzbek message (no internals leaked). */
export function dbErrorMessage(error: PgLikeError): string {
  if (!error) return "Noma'lum xatolik";
  const msg = error.message ?? "";
  if (msg && !ENGLISH_PG.test(msg)) return msg; // our own RAISE messages are already Uzbek
  switch (error.code) {
    case "23505":
      return "Bunday yozuv allaqachon mavjud";
    case "23503":
      return "Bog'liq yozuv topilmadi yoki ishlatilmoqda";
    case "23514":
    case "22023":
    case "22P02":
      return "Kiritilgan ma'lumot noto'g'ri";
    case "42501":
      return "Bu amalni bajarishga ruxsatingiz yo'q";
    case "PGRST116":
      return "Yozuv topilmadi";
    default:
      console.error("[db]", error.code, msg);
      return "Xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.";
  }
}

export function fieldErrors(error: z.ZodError): ActionState {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (errors[key] ??= []).push(issue.message);
  }
  return { ok: false, message: "Formadagi xatolarni tuzating", errors };
}

/** Server-side role gate for actions. Returns the user or an error state. */
export async function authorize(roles: Role[] | null, perm?: string): Promise<CurrentUser | ActionState> {
  const user = await getCurrentUser();
  if (!user || !user.profile.is_active) return { ok: false, message: "Tizimga qayta kiring" };
  const roleOk = !roles || roles.includes(user.profile.role);
  const permOk = perm ? ["director", "admin"].includes(user.profile.role) || user.profile.permissions.includes(perm) : false;
  if (!roleOk && !permOk) return { ok: false, message: "Bu amalni bajarishga ruxsatingiz yo'q" };
  return user;
}

export function isUser(v: CurrentUser | ActionState): v is CurrentUser {
  return (v as CurrentUser).profile !== undefined;
}

export function formObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (typeof v === "string" && !k.startsWith("$ACTION")) out[k] = v;
  });
  return out;
}
