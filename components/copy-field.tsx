"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-porcelain px-3 py-2">
        <code className="min-w-0 flex-1 truncate text-sm text-ink">{value}</code>
        <button
          type="button"
          onClick={copy}
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-royal hover:bg-haze"
        >
          {copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
