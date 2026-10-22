import type { MetadataRoute } from "next";
import { getI18n } from "@/lib/i18n/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { t } = await getI18n();
  return {
    id: "/",
    name: t("Bog'cha boshqaruv tizimi"),
    short_name: t("Bog'cha"),
    description: t("Bog'cha uchun xodimlar, bolalar, davomat va to'lovlarni boshqarish tizimi"),
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#2563eb",
    lang: "uz",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: t("Davomat"), url: "/davomat", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t("Mening kunim"), url: "/mening-kunim", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t("To'lovlar"), url: "/tolovlar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
