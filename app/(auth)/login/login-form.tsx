"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { inputClass, labelClass } from "@/components/ui";
import { login, sendMagicLink } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [loginState, loginAction] = useActionState(login, null);
  const [magicState, magicAction] = useActionState(sendMagicLink, null);

  return (
    <div className="mt-8">
      <div role="tablist" className="mb-6 grid grid-cols-2 rounded-lg border border-line bg-paper p-1 text-sm">
        {(
          [
            ["password", "Con contraseña"],
            ["magic", "Con enlace al correo"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`rounded-md px-3 py-1.5 font-medium ${
              mode === value ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "password" ? (
        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <div>
            <label htmlFor="email" className={labelClass}>Correo</label>
            <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </div>
          <FormMessage state={loginState} />
          <SubmitButton pendingLabel="Entrando…" className="w-full">Entrar</SubmitButton>
        </form>
      ) : (
        <form action={magicAction} className="space-y-4">
          <div>
            <label htmlFor="magic-email" className={labelClass}>Correo</label>
            <input id="magic-email" name="email" type="email" autoComplete="email" required className={inputClass} />
          </div>
          <FormMessage state={magicState} />
          <SubmitButton pendingLabel="Enviando…" className="w-full">Enviar enlace de acceso</SubmitButton>
        </form>
      )}
    </div>
  );
}
