"use client";
import * as React from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectTelegramBot } from "./actions";

export function ConnectBotButton() {
  const [pending, start] = React.useTransition();
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
      const r = await connectTelegramBot();
      if (r.ok) toast.success(r.message); else toast.error(r.message);
    })}>
      <Send className="h-3.5 w-3.5" /> {pending ? "Ulanmoqda..." : "Botni saytga ulash"}
    </Button>
  );
}
