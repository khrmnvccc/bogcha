"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as D from "@radix-ui/react-dialog";
import * as M from "@radix-ui/react-dropdown-menu";
import {
  Baby, Bell, CalendarCheck, Clock, FileBarChart, Home, Layers, LayoutDashboard, LogOut, Megaphone, Menu,
  Phone, Receipt, Settings, Shield, Sun, User, UserCog, Users, Wallet, X, KeyRound,
} from "lucide-react";
import type { NavSection } from "@/lib/nav";
import { cn, initials } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home, layout: LayoutDashboard, users: Users, clock: Clock, baby: Baby, layers: Layers,
  "calendar-check": CalendarCheck, wallet: Wallet, receipt: Receipt, "file-chart": FileBarChart,
  megaphone: Megaphone, "user-cog": UserCog, settings: Settings, shield: Shield, sun: Sun, phone: Phone,
};

type ShellProps = {
  nav: NavSection[];
  user: { name: string; roleLabel: string };
  orgName: string;
  unread: number;
  signOut: () => Promise<void>;
  children: React.ReactNode;
};

function NavLinks({ nav, onNavigate }: { nav: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-5">
      {nav.map((section, i) => (
        <div key={i}>
          {section.title && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.title}</p>}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = ICONS[item.icon] ?? Home;
              const active = pathname === item.href || (item.href !== "/ota-ona" && pathname.startsWith(item.href + "/"));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    <Icon className={cn("h-[18px] w-[18px]", active ? "text-brand-600" : "text-slate-400")} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({ orgName }: { orgName: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
        <Sun className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-900">{orgName}</span>
        <span className="block text-xs text-slate-500">Boshqaruv tizimi</span>
      </span>
    </Link>
  );
}

export function AppShell({ nav, user, orgName, unread, signOut, children }: ShellProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/80 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-100 px-3">
          <Brand orgName={orgName} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <NavLinks nav={nav} />
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur sm:px-6">
          <D.Root open={open} onOpenChange={setOpen}>
            <D.Trigger className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Menyuni ochish">
              <Menu className="h-5 w-5" />
            </D.Trigger>
            <D.Portal>
              <D.Overlay className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" />
              <D.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl lg:hidden">
                <D.Title className="sr-only">Menyu</D.Title>
                <D.Description className="sr-only">Asosiy bo&apos;limlar</D.Description>
                <div className="flex h-16 items-center justify-between border-b border-slate-100 pr-3">
                  <Brand orgName={orgName} />
                  <D.Close className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Yopish">
                    <X className="h-5 w-5" />
                  </D.Close>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-5">
                  <NavLinks nav={nav} onNavigate={() => setOpen(false)} />
                </div>
              </D.Content>
            </D.Portal>
          </D.Root>

          <div className="flex-1 lg:hidden">
            <span className="text-sm font-semibold text-slate-900">{orgName}</span>
          </div>
          <div className="hidden flex-1 lg:block" />

          <Link href="/bildirishnomalar" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Bildirishnomalar">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>

          <M.Root>
            <M.Trigger className="flex items-center gap-2.5 rounded-lg p-1 pr-2 hover:bg-slate-100" aria-label="Foydalanuvchi menyusi">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {initials(user.name) || "?"}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block max-w-40 truncate text-sm font-medium text-slate-800">{user.name}</span>
                <span className="block text-xs text-slate-500">{user.roleLabel}</span>
              </span>
            </M.Trigger>
            <M.Portal>
              <M.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                <M.Item asChild>
                  <Link href="/profil" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-100 data-[highlighted]:bg-slate-100">
                    <User className="h-4 w-4" /> Profil
                  </Link>
                </M.Item>
                <M.Item asChild>
                  <Link href="/profil#parol" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100">
                    <KeyRound className="h-4 w-4" /> Parolni almashtirish
                  </Link>
                </M.Item>
                <M.Separator className="my-1 h-px bg-slate-100" />
                <M.Item asChild>
                  <form action={signOut}>
                    <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 outline-none data-[highlighted]:bg-red-50">
                      <LogOut className="h-4 w-4" /> Chiqish
                    </button>
                  </form>
                </M.Item>
              </M.Content>
            </M.Portal>
          </M.Root>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
