import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { getI18n, getLocale } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";

const inter = Inter({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-inter", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t("Bog'cha boshqaruv tizimi"), template: t("%s · Bog'cha") },
    description: t("Bog'cha uchun xodimlar, bolalar, davomat va to'lovlarni boshqarish tizimi"),
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={inter.variable}>
      <body className="antialiased">
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 4000 }} />
      </body>
    </html>
  );
}
