"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAllRead } from "../profil/actions";

export function MarkAllRead() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button variant="outline" disabled={pending} onClick={() => start(async () => {
      const r = await markAllRead();
      if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.message);
    })}><CheckCheck className="h-4 w-4" /> Barchasini o&apos;qilgan qilish</Button>
  );
}
