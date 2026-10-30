import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import { log, errorMessage } from "@/lib/log";
import { loadAgentSettings } from "@/lib/agent/config";
import type { AgentContext } from "@/lib/agent/context";
import { HISTORY_LIMIT, toModelMessages } from "@/lib/agent/history";
import { runAgent } from "@/lib/agent/run";
import type { WhatsAppCredentials } from "./config";
import { sendAndRecord } from "./outbound";
import { sendTypingIndicator } from "./send";
import type { InboundMessage, WebhookValue } from "./types";

const GREETING_INACTIVITY_MS = 12 * 60 * 60 * 1000;

const MEDIA_LABELS: Record<string, string> = {
  image: "imagen",
  audio: "audio",
  video: "video",
  document: "documento",
  sticker: "sticker",
  location: "ubicación",
  contacts: "contacto",
};

type Admin = SupabaseClient<Database>;

export async function processWebhookValue(credentials: WhatsAppCredentials, value: WebhookValue) {
  const orgId = credentials.organizationId;

  for (const status of value.statuses ?? []) {
    log(status.errors?.length ? "warn" : "info", "whatsapp.status", {
      organization_id: orgId,
      wa_message_id: status.id,
      status: status.status,
      errors: status.errors,
    });
  }

  for (const message of value.messages ?? []) {
    const started = Date.now();
    try {
      const outcome = await processInboundMessage(credentials, value, message);
      log("info", "whatsapp.message_processed", {
        organization_id: orgId,
        wa_message_id: message.id,
        outcome,
        latency_ms: Date.now() - started,
      });
    } catch (err) {
      log("error", "whatsapp.message_failed", {
        organization_id: orgId,
        wa_message_id: message.id,
        error: errorMessage(err),
        latency_ms: Date.now() - started,
      });
    }
  }
}

function extractContent(message: InboundMessage): { content: string; shouldReply: boolean } {
  switch (message.type) {
    case "text":
      return { content: message.text?.body ?? "", shouldReply: true };
    case "button":
      return { content: message.button?.text ?? "", shouldReply: true };
    case "interactive":
      return {
        content: message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? "",
        shouldReply: true,
      };
    case "reaction":
      return { content: "[reacción]", shouldReply: false };
    default:
      return { content: `[${MEDIA_LABELS[message.type] ?? message.type}]`, shouldReply: true };
  }
}

async function processInboundMessage(
  credentials: WhatsAppCredentials,
  value: WebhookValue,
  message: InboundMessage,
): Promise<string> {
  const supabase = createAdminClient();
  const orgId = credentials.organizationId;

  // Idempotencia: Meta puede reenviar el mismo evento
  const { data: duplicate } = await supabase
    .from("messages")
    .select("id")
    .eq("wa_message_id", message.id)
    .maybeSingle();
  if (duplicate) return "duplicate";

  const waPhone = `+${message.from}`;
  const profileName = value.contacts?.find((c) => c.wa_id === message.from)?.profile?.name ?? null;

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .upsert(
      // Sin nombre de perfil en el payload no se pisa el último conocido
      { organization_id: orgId, wa_phone: waPhone, ...(profileName && { metadata: { wa_profile_name: profileName } }) },
      { onConflict: "organization_id,wa_phone" },
    )
    .select()
    .single();
  if (contactError) throw contactError;

  const { data: previous } = await supabase
    .from("conversations")
    .select("last_message_at")
    .eq("organization_id", orgId)
    .eq("contact_id", contact.id)
    .maybeSingle();

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .upsert(
      { organization_id: orgId, contact_id: contact.id, last_message_at: new Date().toISOString() },
      { onConflict: "organization_id,contact_id" },
    )
    .select()
    .single();
  if (conversationError) throw conversationError;

  const { content, shouldReply } = extractContent(message);
  const { data: inserted, error: messageError } = await supabase
    .from("messages")
    .upsert(
      {
        conversation_id: conversation.id,
        organization_id: orgId,
        wa_message_id: message.id,
        direction: "inbound",
        sender: "contact",
        content,
        raw: message,
      },
      { onConflict: "wa_message_id", ignoreDuplicates: true },
    )
    .select("id");
  if (messageError) throw messageError;
  if (!inserted?.length) return "duplicate";
  const inboundId = inserted[0].id;

  if (!shouldReply) return "stored";
  if (!conversation.bot_active) return "stored_bot_inactive";

  // Sin await: es cosmético y no debe retrasar ni bloquear la respuesta
  sendTypingIndicator({
    phoneNumberId: credentials.phoneNumberId,
    accessToken: credentials.accessToken,
    messageId: message.id,
  }).catch((err) =>
    log("warn", "whatsapp.typing_failed", { organization_id: orgId, wa_message_id: message.id, error: errorMessage(err) }),
  );

  const lastActivity = previous?.last_message_at ? new Date(previous.last_message_at).getTime() : 0;
  const greet = Date.now() - lastActivity > GREETING_INACTIVITY_MS;

  const [settings, history] = await Promise.all([
    loadAgentSettings(supabase, orgId),
    loadHistory(supabase, conversation.id),
  ]);

  // Si el cliente mandó otro mensaje mientras tanto, la ejecución de ese mensaje responde a ambos.
  if (await hasNewerInbound(supabase, conversation.id, inboundId)) return "superseded";

  const ctx: AgentContext = {
    mode: "live",
    settings,
    contact: {
      id: contact.id,
      phone: waPhone,
      fullName: contact.full_name,
      isNewPatient: contact.is_new_patient,
    },
    conversationId: conversation.id,
    whatsapp: credentials,
    state: { handoff: false },
  };

  const result = await runAgent({ ctx, messages: toModelMessages(history), greet });
  if (result.handoff) return "handoff";
  if (!result.text) return "no_reply";

  if (await hasNewerInbound(supabase, conversation.id, inboundId)) return "superseded";
  // El dueño pudo desactivar el bot mientras el agente respondía
  const { data: fresh } = await supabase
    .from("conversations")
    .select("bot_active")
    .eq("id", conversation.id)
    .single();
  if (!fresh?.bot_active) return "bot_disabled_during_run";

  await sendAndRecord({
    credentials,
    conversationId: conversation.id,
    to: waPhone,
    text: result.text,
    sender: "bot",
  });
  return "replied";
}

async function loadHistory(supabase: Admin, conversationId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("direction, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return data.reverse();
}

async function hasNewerInbound(supabase: Admin, conversationId: string, inboundId: string) {
  const { data } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Boolean(data && data.id !== inboundId);
}
