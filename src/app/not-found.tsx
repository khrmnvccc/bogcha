import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <h1 className="mt-3 text-lg font-semibold text-slate-900">Sahifa topilmadi</h1>
      <p className="mt-1 text-sm text-slate-500">Bu sahifa mavjud emas yoki uni ko&apos;rishga ruxsatingiz yo&apos;q.</p>
      <LinkButton href="/" className="mt-6">Bosh sahifaga qaytish</LinkButton>
    </div>
  );
}
