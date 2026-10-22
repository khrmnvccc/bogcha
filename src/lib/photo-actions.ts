"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize, isUser, dbErrorMessage, type ActionState } from "@/lib/actions";
import { tr } from "@/lib/i18n/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sniffMime(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Saves (or with null data removes) a child's or employee's photo. Authorization is enforced in set_photo. */
export async function savePhoto(kind: "child" | "employee", ownerId: string, base64: string | null): Promise<ActionState> {
  const user = await authorize(null);
  if (!isUser(user)) return { ...user, message: await tr(user.message ?? "") };
  if ((kind !== "child" && kind !== "employee") || !UUID.test(ownerId)) return { ok: false, message: await tr("Noto'g'ri ma'lumot") };

  let mime: string | null = null;
  if (base64 !== null) {
    if (base64.length > 2_100_000) return { ok: false, message: await tr("Rasm juda katta (1,5 MB dan oshmasin)") };
    mime = sniffMime(Buffer.from(base64.slice(0, 32), "base64"));
    if (!mime) return { ok: false, message: await tr("Faqat JPG, PNG yoki WebP rasm") };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_photo", { p_kind: kind, p_owner: ownerId, p_data: base64, p_mime: mime });
  if (error) return { ok: false, message: await tr(dbErrorMessage(error)) };
  revalidatePath("/", "layout");
  return { ok: true, message: await tr(base64 === null ? "Rasm o'chirildi" : "Rasm saqlandi") };
}
