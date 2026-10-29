import { CalendarCheck, GoogleLogo, WhatsappLogo } from "@phosphor-icons/react/ssr";
import { getSession } from "@/lib/session";
import { getCalendarAccess } from "@/lib/google/oauth";
import { listCalendars } from "@/lib/google/calendar";
import { errorMessage } from "@/lib/log";
import { formatInTz } from "@/lib/time";
import { SubmitButton } from "@/components/submit-button";
import { inputClass, labelClass, pageTitleClass, sectionClass } from "@/components/ui";
import { connectGoogle, disconnectGoogle, saveCalendarId } from "./actions";
import { WebhookPanel } from "./webhook-panel";
import { WhatsAppForm } from "./whatsapp-form";

// Meta solo llama a URLs públicas con HTTPS
function webhookUrlWarning(appUrl: string | undefined): string | null {
  if (!appUrl) return "Falta NEXT_PUBLIC_APP_URL en el servidor: define la URL pública de la app para obtener la Callback URL.";
  try {
    const { protocol, hostname } = new URL(appUrl);
    if (protocol !== "https:" || ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname)) {
      return "Meta solo acepta URLs públicas con HTTPS. En local expón la app con un túnel (ngrok, cloudflared…) y pon esa URL en NEXT_PUBLIC_APP_URL.";
    }
    return null;
  } catch {
    return "NEXT_PUBLIC_APP_URL no es una URL válida.";
  }
}

const GOOGLE_STATUS: Record<string, { text: string; error?: boolean }> = {
  conectado: { text: "Google Calendar quedó conectado." },
  cancelado: { text: "Cancelaste la conexión con Google.", error: true },
  estado_invalido: { text: "La solicitud expiró. Vuelve a pulsar «Conectar con Google».", error: true },
  sin_refresh_token: { text: "Google no devolvió permiso sin conexión. Quita el acceso de la app en tu cuenta de Google y vuelve a conectar.", error: true },
  error: { text: "No se pudo completar la conexión con Google. Revisa las variables GOOGLE_* del servidor.", error: true },
};

export default async function IntegracionesPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const { supabase, organizationId, org } = await getSession();
  const { google: googleStatus } = await searchParams;

  const [{ data: whatsapp }, { data: googleConfig }] = await Promise.all([
    supabase
      .from("whatsapp_configs")
      .select("phone_number_id, waba_id, verify_token, webhook_verified_at, last_event_at")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase.from("google_calendar_configs").select("calendar_id").eq("organization_id", organizationId).maybeSingle(),
  ]);

  let calendars: { id: string; summary: string; primary?: boolean }[] = [];
  let calendarError: string | null = null;
  if (googleConfig) {
    try {
      const access = await getCalendarAccess(organizationId);
      if (access) calendars = await listCalendars(access.accessToken);
    } catch (err) {
      calendarError = errorMessage(err);
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  const webhookUrl = `${appUrl ?? ""}/api/webhooks/whatsapp`;
  const formatStatusDate = (iso: string | null | undefined) =>
    iso
      ? formatInTz(new Date(iso), org.timezone, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      : null;
  const status = googleStatus ? GOOGLE_STATUS[googleStatus] : undefined;

  return (
    <div className="max-w-4xl">
      <h1 className={pageTitleClass}>Integraciones</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Conecta tu número de WhatsApp Business para que el asistente responda, y tu Google Calendar para que agende en tu agenda real.
      </p>

      <section className={`${sectionClass} mt-8`}>
        <div className="flex items-start gap-3">
          <WhatsappLogo size={28} weight="fill" className="shrink-0 text-royal" />
          <div>
            <h2 className="text-lg font-semibold">WhatsApp Cloud API</h2>
            <p className="text-sm text-ink-soft">
              {!whatsapp
                ? "Aún no está conectado. Guarda las credenciales y luego configura el webhook en Meta."
                : whatsapp.webhook_verified_at
                  ? "Conectado. Puedes actualizar las credenciales cuando quieras."
                  : "Credenciales guardadas. Falta verificar el webhook en Meta."}
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-line pt-6">
          <h3 className="mb-4 font-semibold">Credenciales</h3>
          <WhatsAppForm config={whatsapp} />
        </div>

        <div className="mt-6 border-t border-line pt-6">
          <h3 className="font-semibold">Webhook en Meta</h3>
          <p className="mb-4 text-sm text-ink-soft">Así Meta le entrega a la app los mensajes que recibe tu número.</p>
          <WebhookPanel
            webhookUrl={webhookUrl}
            urlWarning={webhookUrlWarning(appUrl)}
            verifyToken={whatsapp?.verify_token ?? null}
            verifiedAt={formatStatusDate(whatsapp?.webhook_verified_at)}
            lastEventAt={formatStatusDate(whatsapp?.last_event_at)}
          />
        </div>
      </section>

      <section className={`${sectionClass} mt-6`}>
        <div className="flex items-start gap-3">
          <CalendarCheck size={28} weight="fill" className="shrink-0 text-royal" />
          <div>
            <h2 className="text-lg font-semibold">Google Calendar</h2>
            <p className="text-sm text-ink-soft">
              {googleConfig
                ? "Conectado. El asistente consulta tu disponibilidad y crea los eventos aquí."
                : "Sin conectar: el asistente usa tu horario de atención y las citas ya registradas."}
            </p>
          </div>
        </div>

        {status && (
          <p
            role={status.error ? "alert" : "status"}
            className={`mt-4 rounded-lg px-3 py-2 text-sm ${status.error ? "bg-danger-soft text-danger" : "bg-haze text-royal-dark"}`}
          >
            {status.text}
          </p>
        )}

        {googleConfig ? (
          <div className="mt-6 space-y-4">
            {calendarError ? (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                No se pudieron leer tus calendarios: {calendarError}. Vuelve a conectar Google.
              </p>
            ) : (
              <form action={saveCalendarId} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label htmlFor="calendar_id" className={labelClass}>Calendario donde agendar</label>
                  <select id="calendar_id" name="calendar_id" defaultValue={googleConfig.calendar_id} className={inputClass}>
                    {googleConfig.calendar_id === "primary" && <option value="primary">Calendario principal</option>}
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.summary}
                        {c.primary ? " (principal)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <SubmitButton pendingLabel="Guardando…">Usar este calendario</SubmitButton>
              </form>
            )}
            <div className="flex flex-wrap gap-3">
              <form action={connectGoogle}>
                <SubmitButton variant="secondary">Volver a conectar</SubmitButton>
              </form>
              <form action={disconnectGoogle}>
                <SubmitButton variant="danger" pendingLabel="Desconectando…">Desconectar</SubmitButton>
              </form>
            </div>
          </div>
        ) : (
          <form action={connectGoogle} className="mt-6">
            <SubmitButton>
              <GoogleLogo size={18} weight="bold" />
              Conectar con Google
            </SubmitButton>
          </form>
        )}
      </section>
    </div>
  );
}
