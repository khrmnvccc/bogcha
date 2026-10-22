"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAllRead } from "../profil/actions";
import { useI18n } from "@/lib/i18n/client";

export function MarkAllRead() {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button variant="outline" disabled={pending} onClick={() => start(async () => {
      const r = await markAllRead();
      if (r.ok) { toast.success(t(r.message ?? "")); router.refresh(); } else toast.error(t(r.message ?? ""));
    })}><CheckCheck className="h-4 w-4" />{" "}{t("Barchasini o'qilgan qilish")}</Button>
  );
}
