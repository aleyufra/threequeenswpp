import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { log, errorMessage } from "@/lib/log";
import { getWhatsAppCredentialsByPhoneNumberId, type WhatsAppCredentials } from "@/lib/whatsapp/config";
import { processWebhookValue } from "@/lib/whatsapp/process";
import { verifySignature } from "@/lib/whatsapp/signature";
import type { WebhookPayload, WebhookValue } from "@/lib/whatsapp/types";

// crypto nativo para el HMAC y procesamiento largo en after(): runtime Node, nunca edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Verificación del webhook: el verify_token es único por organización (mapeo en whatsapp_configs).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new Response("Bad request", { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("whatsapp_configs")
      .select("organization_id")
      .eq("verify_token", token)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      log("warn", "whatsapp.verify_rejected", { reason: "unknown_verify_token" });
      return new Response("Forbidden", { status: 403 });
    }
    // Estado visible en /integraciones; si falla no impide la verificación
    const { error: statusError } = await admin
      .from("whatsapp_configs")
      .update({ webhook_verified_at: new Date().toISOString() })
      .eq("organization_id", data.organization_id);
    if (statusError) log("warn", "whatsapp.verify_status_failed", { error: errorMessage(statusError) });
    log("info", "whatsapp.verify_ok", { organization_id: data.organization_id });
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (err) {
    log("error", "whatsapp.verify_failed", { error: errorMessage(err) });
    return new Response("Forbidden", { status: 403 });
  }
}

export async function POST(request: Request) {
  const started = Date.now();
  // Body crudo: la firma se calcula sobre los bytes exactos que envió Meta
  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-hub-signature-256");

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as WebhookPayload;
  } catch {
    log("warn", "whatsapp.webhook_invalid_json");
    return new Response("Bad request", { status: 400 });
  }

  // Cada phone_number_id pertenece a una organización con su propio App Secret
  const valuesByPhone = new Map<string, WebhookValue[]>();
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      if (change.field !== "messages" || !phoneNumberId) continue;
      valuesByPhone.set(phoneNumberId, [...(valuesByPhone.get(phoneNumberId) ?? []), change.value]);
    }
  }

  const verified: { credentials: WhatsAppCredentials; values: WebhookValue[] }[] = [];
  let invalidSignature = false;
  for (const [phoneNumberId, values] of valuesByPhone) {
    let credentials: WhatsAppCredentials | null;
    try {
      credentials = await getWhatsAppCredentialsByPhoneNumberId(phoneNumberId);
    } catch (err) {
      // Fallo de infraestructura (BD, cifrado): 500 para que Meta reintente
      log("error", "whatsapp.credentials_lookup_failed", { phone_number_id: phoneNumberId, error: errorMessage(err) });
      return new Response("Internal error", { status: 500 });
    }
    if (!credentials) {
      log("warn", "whatsapp.unknown_phone_number", { phone_number_id: phoneNumberId });
      continue;
    }
    if (!verifySignature(rawBody, signature, credentials.appSecret)) {
      invalidSignature = true;
      log("warn", "whatsapp.invalid_signature", { organization_id: credentials.organizationId });
      continue;
    }
    verified.push({ credentials, values });
  }

  if (invalidSignature && verified.length === 0) {
    return new Response("Invalid signature", { status: 401 });
  }

  // Responder 200 de inmediato; el procesamiento (BD + agente + envío) corre después.
  if (verified.length > 0) {
    after(async () => {
      const admin = createAdminClient();
      const now = new Date().toISOString();
      const orgIds = verified.map((v) => v.credentials.organizationId);
      const { error } = await admin.from("whatsapp_configs").update({ last_event_at: now }).in("organization_id", orgIds);
      if (error) log("warn", "whatsapp.event_status_failed", { error: errorMessage(error) });
      // Un evento firmado prueba que la suscripción funciona aunque no hayamos visto el GET de verificación
      const { error: verifyError } = await admin
        .from("whatsapp_configs")
        .update({ webhook_verified_at: now })
        .in("organization_id", orgIds)
        .is("webhook_verified_at", null);
      if (verifyError) log("warn", "whatsapp.event_status_failed", { error: errorMessage(verifyError) });

      for (const { credentials, values } of verified) {
        for (const value of values) {
          try {
            await processWebhookValue(credentials, value);
          } catch (err) {
            log("error", "whatsapp.process_failed", {
              organization_id: credentials.organizationId,
              error: errorMessage(err),
            });
          }
        }
      }
    });
  }

  log("info", "whatsapp.webhook_received", {
    organization_ids: verified.map((v) => v.credentials.organizationId),
    message_ids: verified.flatMap((v) => v.values.flatMap((val) => val.messages?.map((m) => m.id) ?? [])),
    latency_ms: Date.now() - started,
  });
  return new Response("EVENT_RECEIVED", { status: 200 });
}
