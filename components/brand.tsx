import { Crown } from "@phosphor-icons/react/ssr";

export const BRAND_NAME = "Three Queens";

export function BrandIcon({ className = "" }: { className?: string }) {
  return (
    <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-royal shadow-sm ring-1 shadow-royal/20 ring-white/80 ${className}`}>
      <Crown size={22} weight="fill" />
    </span>
  );
}

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandIcon />
      <span className="flex flex-col leading-none">
        <span className="font-wordmark text-xl tracking-wide text-ink uppercase">{BRAND_NAME}</span>
        <span className="-mt-1 self-end pr-0.5 font-script text-base text-royal -rotate-3">Calzados</span>
      </span>
    </span>
  );
}
