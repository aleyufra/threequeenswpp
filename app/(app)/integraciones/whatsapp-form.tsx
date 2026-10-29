"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { hintClass, inputClass, labelClass } from "@/components/ui";
import { saveWhatsAppConfig, testWhatsAppConnection } from "./actions";

type Props = {
  config: { phone_number_id: string; waba_id: string } | null;
};

export function WhatsAppForm({ config }: Props) {
  const [saveState, saveAction] = useActionState(saveWhatsAppConfig, null);
  const [testState, testAction] = useActionState(testWhatsAppConnection, null);
  const secretHint = config ? "Déjalo vacío para conservar el valor guardado." : undefined;

  return (
    <div className="space-y-4">
      <form action={saveAction} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phone_number_id" className={labelClass}>Phone Number ID</label>
          <input id="phone_number_id" name="phone_number_id" defaultValue={config?.phone_number_id} required className={inputClass} />
        </div>
        <div>
          <label htmlFor="waba_id" className={labelClass}>WhatsApp Business Account ID</label>
          <input id="waba_id" name="waba_id" defaultValue={config?.waba_id} required className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="access_token" className={labelClass}>Access token (System User)</label>
          <input
            id="access_token"
            name="access_token"
            type="password"
            autoComplete="off"
            placeholder={config ? "••••••••••••" : ""}
            className={inputClass}
          />
          <p className={hintClass}>
            {secretHint ?? "Token permanente de un System User con whatsapp_business_messaging y whatsapp_business_management."}
          </p>
        </div>
        <div>
          <label htmlFor="app_secret" className={labelClass}>App Secret</label>
          <input
            id="app_secret"
            name="app_secret"
            type="password"
            autoComplete="off"
            placeholder={config ? "••••••••••••" : ""}
            className={inputClass}
          />
          <p className={hintClass}>{secretHint ?? "Se usa para verificar la firma de cada evento."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <SubmitButton pendingLabel="Guardando…">Guardar credenciales</SubmitButton>
          {config && (
            <SubmitButton variant="secondary" formAction={testAction} pendingLabel="Probando…">
              Probar conexión
            </SubmitButton>
          )}
        </div>
      </form>
      <FormMessage state={testState ?? saveState} />
    </div>
  );
}
