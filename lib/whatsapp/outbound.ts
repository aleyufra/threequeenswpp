import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";
import type { WhatsAppCredentials } from "./config";
import { sendWhatsAppMessage } from "./send";

// Envía un texto por Cloud API y lo registra como mensaje outbound de la conversación.
export async function sendAndRecord(params: {
  credentials: WhatsAppCredentials;
  conversationId: string;
  to: string;
  text: string;
  sender: "bot" | "human";
  raw?: Json;
}) {
  const { credentials, conversationId, to, text, sender, raw } = params;
  const { wamid } = await sendWhatsAppMessage({
    phoneNumberId: credentials.phoneNumberId,
    accessToken: credentials.accessToken,
    to,
    text,
  });

  const supabase = createAdminClient();
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    organization_id: credentials.organizationId,
    wa_message_id: wamid,
    direction: "outbound",
    sender,
    content: text,
    raw: raw ?? null,
  });
  if (error) throw error;

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("organization_id", credentials.organizationId);

  return { wamid };
}
