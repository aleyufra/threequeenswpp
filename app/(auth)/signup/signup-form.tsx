"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { hintClass, inputClass, labelClass } from "@/components/ui";
import { signup } from "../actions";

export function SignupForm() {
  const [state, action] = useActionState(signup, null);

  if (state?.ok) {
    return (
      <div className="mt-8">
        <FormMessage state={state} />
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-4">
      <div>
        <label htmlFor="business_name" className={labelClass}>Nombre del negocio</label>
        <input id="business_name" name="business_name" required className={inputClass} placeholder="Clínica Dental Sonrisa" />
      </div>
      <div>
        <label htmlFor="full_name" className={labelClass}>Tu nombre</label>
        <input id="full_name" name="full_name" autoComplete="name" className={inputClass} />
      </div>
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
          autoComplete="new-password"
          minLength={8}
          required
          className={inputClass}
        />
        <p className={hintClass}>Mínimo 8 caracteres.</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Creando cuenta…" className="w-full">Crear cuenta</SubmitButton>
    </form>
  );
}
