import { GRAPH_API_BASE } from "./constants";

type GraphError = { error?: { message?: string; code?: number } };
type SendResponse = GraphError & { messages?: { id: string }[] };

export async function sendWhatsAppMessage(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
}): Promise<{ wamid: string | null }> {
  const res = await fetch(`${GRAPH_API_BASE}/${params.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      // Argentina: el webhook trae el móvil como 549XXXXXXXXXX, pero Cloud API espera 54XXXXXXXXXX
      to: params.to.replace(/^\+/, "").replace(/^549(\d{10})$/, "54$1"),
      type: "text",
      text: { preview_url: false, body: params.text },
    }),
  });

  const json = (await res.json()) as SendResponse;
  if (!res.ok) {
    throw new Error(`WhatsApp send failed (${res.status}): ${json.error?.message ?? "unknown error"}`);
  }
  return { wamid: json.messages?.[0]?.id ?? null };
}

// GET /{phone_number_id} para validar credenciales desde /integraciones
export async function fetchPhoneNumberInfo(phoneNumberId: string, accessToken: string) {
  const res = await fetch(
    `${GRAPH_API_BASE}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const json = (await res.json()) as GraphError & {
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
  };
  if (!res.ok) throw new Error(json.error?.message ?? `Error ${res.status}`);
  return json;
}

// POST /{waba_id}/subscribed_apps (idempotente): sin esto Meta no envía al webhook los mensajes del número
export async function subscribeAppToWaba(wabaId: string, accessToken: string) {
  const res = await fetch(`${GRAPH_API_BASE}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as GraphError & { success?: boolean };
  if (!res.ok || !json.success) throw new Error(json.error?.message ?? `Error ${res.status}`);
}
