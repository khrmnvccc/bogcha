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
import { useI18n } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { CommandPalette } from "@/components/command-palette";
import { InstallBanner } from "@/components/pwa";
import { Avatar } from "@/components/avatar";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home, layout: LayoutDashboard, users: Users, clock: Clock, baby: Baby, layers: Layers,
  "calendar-check": CalendarCheck, wallet: Wallet, receipt: Receipt, "file-chart": FileBarChart,
  megaphone: Megaphone, "user-cog": UserCog, settings: Settings, shield: Shield, sun: Sun, phone: Phone,
};

type ShellProps = {
  nav: NavSection[];
  user: { name: string; roleLabel: string; employeeId: string | null; photo: string | null; staff: boolean };
  orgName: string;
  unread: number;
  signOut: () => Promise<void>;
  children: React.ReactNode;
};

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/ota-ona" && pathname.startsWith(href + "/"));
}

function NavLinks({ nav, onNavigate }: { nav: NavSection[]; onNavigate?: () => void }) {
  const { t } = useI18n();
  const pathname = usePathname();
  return (
    <nav className="space-y-5">
      {nav.map((section, i) => (
        <div key={i}>
          {section.title && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t(section.title)}</p>}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = ICONS[item.icon] ?? Home;
              const active = isActive(pathname, item.href);
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
                    {t(item.label)}
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
  const { t } = useI18n();
  return (
    <Link href="/" className="flex items-center gap-2.5 px-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
        <Sun className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-900">{orgName}</span>
        <span className="block text-xs text-slate-500">{t("Boshqaruv tizimi")}</span>
      </span>
    </Link>
  );
}

/** Phone-only tab bar: the first four destinations plus the full menu. */
function BottomNav({ nav, onMenu }: { nav: NavSection[]; onMenu: () => void }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = nav.flatMap((s) => s.items).slice(0, 4);
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t shadow-[0_-4px_12px_rgba(15,23,42,0.04)] border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label={t("Asosiy bo'limlar")}>
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? Home;
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link href={item.href} className={cn("flex h-16 flex-col items-center justify-center gap-1 px-0.5 text-[10px] font-medium leading-tight", active ? "text-brand-700" : "text-slate-500")}>
                <Icon className={cn("h-5 w-5", active ? "text-brand-600" : "text-slate-400")} />
                <span className="line-clamp-1 max-w-full text-center">{t(item.short ?? item.label)}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={onMenu} className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[10px] font-medium text-slate-500">
            <Menu className="h-5 w-5 text-slate-400" />
            <span>{t("Menyu")}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

export function AppShell({ nav, user, orgName, unread, signOut, children }: ShellProps) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [signingOut, startSignOut] = React.useTransition();
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
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur sm:h-16 sm:gap-3 sm:px-6">
          <D.Root open={open} onOpenChange={setOpen}>
            <D.Trigger className="-ml-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label={t("Menyuni ochish")}>
              <Menu className="h-5 w-5" />
            </D.Trigger>
            <D.Portal>
              <D.Overlay className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" />
              <D.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl lg:hidden">
                <D.Title className="sr-only">{t("Menyu")}</D.Title>
                <D.Description className="sr-only">{t("Asosiy bo'limlar")}</D.Description>
                <div className="flex h-16 items-center justify-between border-b border-slate-100 pr-3">
                  <Brand orgName={orgName} />
                  <D.Close className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={t("Yopish")}>
                    <X className="h-5 w-5" />
                  </D.Close>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-5">
                  <NavLinks nav={nav} onNavigate={() => setOpen(false)} />
                </div>
              </D.Content>
            </D.Portal>
          </D.Root>

          <div className="min-w-0 flex-1 lg:hidden">
            <span className="block truncate text-sm font-semibold text-slate-900">{orgName}</span>
          </div>
          <div className="hidden flex-1 lg:block" />

          <CommandPalette nav={nav} people={user.staff} />
          <LanguageSwitcher />

          <Link href="/bildirishnomalar" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label={t("Bildirishnomalar")}>
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>

          <M.Root>
            <M.Trigger className="flex items-center gap-2.5 rounded-lg p-1 pr-2 hover:bg-slate-100" aria-label={t("Foydalanuvchi menyusi")}>
              {user.employeeId
                ? <Avatar kind="employee" id={user.employeeId} name={user.name} version={user.photo} className="h-8 w-8 ring-0" />
                : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                  {initials(user.name) || "?"}
                </span>}
              <span className="hidden text-left lg:block">
                <span className="block max-w-40 truncate text-sm font-medium text-slate-800">{user.name}</span>
                <span className="block text-xs text-slate-500">{user.roleLabel}</span>
              </span>
            </M.Trigger>
            <M.Portal>
              <M.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                <M.Item asChild>
                  <Link href="/profil" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-100 data-[highlighted]:bg-slate-100">
                    <User className="h-4 w-4" />{" "}{t("Profil")}</Link>
                </M.Item>
                <M.Item asChild>
                  <Link href="/profil#parol" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100">
                    <KeyRound className="h-4 w-4" />{" "}{t("Parolni almashtirish")}</Link>
                </M.Item>
                <M.Separator className="my-1 h-px bg-slate-100" />
                {/* The menu unmounts on select, so a <form> inside it never submits; call the action directly. */}
                <M.Item
                  disabled={signingOut}
                  onSelect={() => startSignOut(() => signOut())}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 outline-none data-[highlighted]:bg-red-50 data-[disabled]:opacity-50"
                >
                  <LogOut className="h-4 w-4" /> {signingOut ? t("Chiqilmoqda...") : t("Chiqish")}
                </M.Item>
              </M.Content>
            </M.Portal>
          </M.Root>
        </header>

        <main className="has-bottom-nav mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8"><InstallBanner />{children}</main>
      </div>
      <BottomNav nav={nav} onMenu={() => setOpen(true)} />
    </div>
  );
}
