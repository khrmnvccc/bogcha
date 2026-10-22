"use client";
import * as React from "react";

/** On phones the table is shown as cards; each cell gets its column title as a label. */
export function ResponsiveTable({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const label = () => {
      const heads = Array.from(el.querySelectorAll("thead th")).map((th) => th.textContent?.trim() ?? "");
      el.querySelectorAll("tbody tr").forEach((tr) => {
        let col = 0;
        Array.from(tr.children).forEach((td) => {
          const l = heads[col] ?? "";
          if (td.getAttribute("data-label") !== l) td.setAttribute("data-label", l);
          col += Number(td.getAttribute("colspan") ?? 1);
        });
      });
    };
    label();
    const mo = new MutationObserver(label);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
