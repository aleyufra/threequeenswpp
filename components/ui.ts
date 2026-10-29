// Clases compartidas de la UI (Tailwind)

export const inputClass =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20 disabled:opacity-60";

export const labelClass = "mb-1.5 block text-sm font-medium text-ink";

export const hintClass = "mt-1 text-xs text-ink-soft";

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-royal px-4 py-2 text-sm font-medium text-white hover:bg-royal-dark disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:border-ink-soft/40 disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-ink/5 hover:text-ink disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-danger/30 bg-paper px-4 py-2 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-60",
};

export const pageTitleClass = "font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl";

export const sectionClass = "rounded-xl border border-line bg-paper p-5 sm:p-6";
