export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="h-8 w-56 rounded-lg bg-slate-200/70" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-200/60" />)}
      </div>
      <div className="h-72 rounded-xl bg-slate-200/50" />
    </div>
  );
}
