import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

/** Reads a single string from Next.js searchParams. */
export function sp(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v || undefined;
}

/** Escapes characters that have meaning inside PostgREST ilike filters. */
export function safeSearch(q: string | undefined): string | undefined {
  if (!q) return undefined;
  const cleaned = q.replace(/[%_,()*\\]/g, " ").trim().slice(0, 80);
  return cleaned || undefined;
}
