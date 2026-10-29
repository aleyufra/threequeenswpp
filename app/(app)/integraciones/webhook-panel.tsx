"use client";

import { useActionState } from "react";
import { ArrowsClockwise, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { CopyField } from "@/components/copy-field";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { regenerateVerifyToken } from "./actions";

type Props = {
  webhookUrl: string;
  urlWarning: string | null;
  verifyToken: string | null;
  verifiedAt: string | null;
  lastEventAt: string | null;
};

const STEPS = [
  "En Meta for Developers abre tu app y entra a WhatsApp → Configuración.",
  "En «Webhook» pulsa «Editar» y pega la Callback URL y el Verify token de aquí.",
  "Pulsa «Verificar y guardar». Este panel mostrará el webhook como verificado.",
  "En «Campos del webhook» suscríbete a messages.",
];

export function WebhookPanel({ webhookUrl, urlWarning, verifyToken, verifiedAt, lastEventAt }: Props) {
  const [state, regenerateAction] = useActionState(regenerateVerifyToken, null);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <CopyField label="Callback URL" value={webhookUrl} />
        {verifyToken ? (
          <CopyField label="Verify token" value={verifyToken} />
        ) : (
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Verify token</p>
            <p className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-ink-soft">
              Se genera al guardar las credenciales.
            </p>
          </div>
        )}
      </div>

      {urlWarning && (
        <p role="alert" className="flex gap-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">
          <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" />
          {urlWarning}
        </p>
      )}

      {verifyToken && (
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            {verifiedAt ? (
              <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-royal" />
            ) : (
              <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-amber" />
            )}
            <span>{verifiedAt ? `Meta verificó el webhook el ${verifiedAt}.` : "Meta aún no ha verificado este webhook."}</span>
          </li>
          <li className="flex items-start gap-2">
            {lastEventAt ? (
              <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-royal" />
            ) : (
              <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-amber" />
            )}
            <span>
              {lastEventAt
                ? `Último evento recibido: ${lastEventAt}.`
                : "Todavía no llegan eventos. Pulsa «Probar conexión» (suscribe la app a tu WABA), revisa la suscripción a messages y escribe al número."}
            </span>
          </li>
        </ul>
      )}

      <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft marker:text-ink-soft">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      {verifyToken && (
        <form
          action={regenerateAction}
          onSubmit={(e) => {
            if (!confirm("El token actual dejará de funcionar y tendrás que verificar el webhook de nuevo en Meta. ¿Continuar?")) {
              e.preventDefault();
            }
          }}
          className="space-y-3"
        >
          <SubmitButton variant="secondary" pendingLabel="Generando…">
            <ArrowsClockwise size={16} />
            Generar nuevo verify token
          </SubmitButton>
          <FormMessage state={state} />
        </form>
      )}
    </div>
  );
}
