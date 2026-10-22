import type { CurrentUser } from "@/lib/auth";

export type NavItem = { href: string; label: string; icon: string };
export type NavSection = { title?: string; items: NavItem[] };

export function navFor(user: CurrentUser): NavSection[] {
  const role = user.profile.role;
  const perms = user.profile.permissions;
  const isEmployee = Boolean(user.employeeId);

  if (role === "parent") {
    return [{
      items: [
        { href: "/ota-ona", label: "Bosh sahifa", icon: "home" },
        { href: "/ota-ona/davomat", label: "Davomat", icon: "calendar-check" },
        { href: "/ota-ona/tolovlar", label: "To'lovlar", icon: "wallet" },
        { href: "/elonlar", label: "E'lonlar", icon: "megaphone" },
        { href: "/ota-ona/aloqa", label: "Bog'cha bilan aloqa", icon: "phone" },
      ],
    }];
  }

  if (role === "teacher") {
    const items: NavItem[] = [
      { href: "/mening-kunim", label: "Mening kunim", icon: "sun" },
      { href: "/ishga-kelish", label: "Ishga kelish-ketish", icon: "clock" },
      { href: "/guruhlar", label: "Guruhlarim", icon: "layers" },
      { href: "/bolalar", label: "Bolalar", icon: "baby" },
      { href: "/davomat", label: "Bolalar davomati", icon: "calendar-check" },
      { href: "/elonlar", label: "E'lonlar", icon: "megaphone" },
    ];
    if (perms.includes("finance.view")) items.push({ href: "/hisobotlar", label: "Hisobotlar", icon: "file-chart" });
    return [{ items }];
  }

  if (role === "accountant") {
    const items: NavItem[] = [{ href: "/panel", label: "Boshqaruv paneli", icon: "layout" }];
    if (isEmployee) items.push({ href: "/mening-kunim", label: "Mening kunim", icon: "sun" });
    return [
      { items },
      {
        title: "Moliya",
        items: [
          { href: "/tolovlar", label: "Oylik to'lovlar", icon: "wallet" },
          { href: "/tolovlar-tarixi", label: "To'lovlar tarixi", icon: "receipt" },
          { href: "/hisobotlar", label: "Hisobotlar", icon: "file-chart" },
        ],
      },
      {
        title: "Boshqa",
        items: [
          { href: "/bolalar", label: "Bolalar", icon: "baby" },
          { href: "/elonlar", label: "E'lonlar", icon: "megaphone" },
        ],
      },
    ];
  }

  // director / admin
  const top: NavItem[] = [{ href: "/panel", label: "Boshqaruv paneli", icon: "layout" }];
  if (isEmployee) top.push({ href: "/mening-kunim", label: "Mening kunim", icon: "sun" });
  return [
    { items: top },
    {
      title: "Xodimlar",
      items: [
        { href: "/xodimlar", label: "Xodimlar", icon: "users" },
        { href: "/ishga-kelish", label: "Ishga kelish-ketish", icon: "clock" },
      ],
    },
    {
      title: "Bolalar",
      items: [
        { href: "/bolalar", label: "Bolalar", icon: "baby" },
        { href: "/guruhlar", label: "Guruhlar", icon: "layers" },
        { href: "/davomat", label: "Bolalar davomati", icon: "calendar-check" },
      ],
    },
    {
      title: "Moliya",
      items: [
        { href: "/tolovlar", label: "Oylik to'lovlar", icon: "wallet" },
        { href: "/tolovlar-tarixi", label: "To'lovlar tarixi", icon: "receipt" },
        { href: "/hisobotlar", label: "Hisobotlar", icon: "file-chart" },
      ],
    },
    {
      title: "Boshqaruv",
      items: [
        { href: "/elonlar", label: "E'lonlar", icon: "megaphone" },
        { href: "/foydalanuvchilar", label: "Foydalanuvchilar", icon: "user-cog" },
        { href: "/sozlamalar", label: "Sozlamalar", icon: "settings" },
        { href: "/audit", label: "Audit jurnali", icon: "shield" },
      ],
    },
  ];
}
