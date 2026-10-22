"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import * as D from "@radix-ui/react-dialog";
import { Search, CornerDownLeft, Loader2, ArrowRight } from "lucide-react";
import type { NavSection } from "@/lib/nav";
import { quickSearch, type SearchHit } from "@/lib/search-actions";
import { Avatar } from "@/components/avatar";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Item = { key: string; href: string; label: string; sub?: string | null; hit?: SearchHit };

/** Ctrl+K palette: jump to any page, or find a child or employee by name. */
export function CommandPalette({ nav, people }: { nav: NavSection[]; people: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!people || q.trim().length < 2) return;
    let stale = false;
    const id = setTimeout(async () => {
      setLoading(true);
      const res = await quickSearch(q).catch(() => []);
      if (!stale) { setHits(res); setLoading(false); }
    }, 200);
    return () => { stale = true; clearTimeout(id); };
  }, [q, people]);

  const needle = q.trim().toLocaleLowerCase();
  const pages: Item[] = nav.flatMap((s) => s.items)
    .filter((i) => !needle || t(i.label).toLocaleLowerCase().includes(needle) || i.label.toLowerCase().includes(needle))
    .map((i) => ({ key: i.href, href: i.href, label: t(i.label) }));
  const found: Item[] = needle.length >= 2 ? hits.map((h) => ({ key: `${h.kind}-${h.id}`, href: h.href, label: h.name, sub: h.sub, hit: h })) : [];
  const items = [...found, ...pages];

  function go(i: Item | undefined) {
    if (!i) return;
    setOpen(false);
    router.push(i.href);
  }
  function onOpenChange(o: boolean) {
    setOpen(o);
    if (!o) { setQ(""); setHits([]); setActive(0); }
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(items[active]); }
  }

  const row = (i: Item, idx: number) => (
    <li key={i.key}>
      <button type="button" onMouseMove={() => setActive(idx)} onClick={() => go(i)}
        className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm", idx === active ? "bg-brand-50 text-brand-800" : "text-slate-700")}>
        {i.hit ? <Avatar kind={i.hit.kind} id={i.hit.id} name={i.hit.name} version={i.hit.photo} size="xs" />
          : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400"><ArrowRight className="h-3.5 w-3.5" /></span>}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{i.label}</span>
          {i.sub && <span className="block truncate text-xs text-slate-500">{i.sub}</span>}
        </span>
        {idx === active && <CornerDownLeft className="h-3.5 w-3.5 text-brand-400" />}
      </button>
    </li>
  );

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Trigger className="flex h-9 items-center gap-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:w-72 lg:border lg:border-slate-200 lg:bg-slate-50/60 lg:px-3 lg:text-sm" aria-label={t("Qidirish")}>
        <Search className="h-5 w-5 lg:h-4 lg:w-4" />
        <span className="hidden flex-1 text-left lg:inline">{people ? t("Bola yoki xodimni qidirish...") : t("Bo'limni qidirish...")}</span>
        <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-400 lg:inline">Ctrl K</kbd>
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px]" />
        <D.Content onKeyDown={onKeyDown} className="fixed inset-x-3 top-3 z-50 mx-auto max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl sm:top-[12vh]">
          <D.Title className="sr-only">{t("Qidirish")}</D.Title>
          <D.Description className="sr-only">{t("Bo'lim, bola yoki xodimni toping")}</D.Description>
          <div className="flex items-center gap-3 border-b border-slate-100 px-4">
            <Search className="h-5 w-5 shrink-0 text-slate-400" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }}
              placeholder={people ? t("Ism yoki bo'lim nomini yozing") : t("Bo'lim nomini yozing")}
              className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400" />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          </div>
          <div className="max-h-[60dvh] overflow-y-auto p-2">
            {found.length > 0 && (<>
              <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-slate-400">{t("Odamlar")}</p>
              <ul>{found.map((i, idx) => row(i, idx))}</ul>
            </>)}
            {pages.length > 0 && (<>
              <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-slate-400">{t("Bo'limlar")}</p>
              <ul>{pages.map((i, idx) => row(i, found.length + idx))}</ul>
            </>)}
            {items.length === 0 && !loading && <p className="px-3 py-8 text-center text-sm text-slate-500">{t("Hech narsa topilmadi")}</p>}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
