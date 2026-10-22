import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Notice } from "@/components/ui/misc";
import { PasswordForm } from "@/components/password-form";

export const metadata: Metadata = { title: "Yangi parol o'rnatish" };

export default async function ForcePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/kirish");
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
      <h2 className="text-lg font-semibold text-slate-900">Yangi parol o&apos;rnating</h2>
      <Notice tone="blue" className="my-4">
        Xush kelibsiz, {user.profile.full_name}! Xavfsizlik uchun administrator bergan vaqtinchalik parolni o&apos;zingiz
        biladigan yangi parolga almashtiring.
      </Notice>
      <PasswordForm forced />
    </div>
  );
}
