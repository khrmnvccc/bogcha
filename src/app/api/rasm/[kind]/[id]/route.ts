import { createClient } from "@/lib/supabase/server";

/** Serves a stored photo. Visibility follows the owner's RLS, so a parent only sees their own child. */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if ((kind !== "child" && kind !== "employee") || !/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.from("photos").select("data, mime").eq("kind", kind).eq("owner_id", id).maybeSingle();
  if (!data) return new Response(null, { status: 404 });
  const hex = String(data.data);
  const body = Buffer.from(hex.startsWith("\\x") ? hex.slice(2) : hex, "hex");
  const versioned = new URL(req.url).searchParams.has("v");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": data.mime,
      "Cache-Control": versioned ? "private, max-age=31536000, immutable" : "private, no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
