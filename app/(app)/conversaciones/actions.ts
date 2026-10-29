"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { errorMessage } from "@/lib/log";
import { getWhatsAppCredentials } from "@/lib/whatsapp/config";
import { sendAndRecord } from "@/lib/whatsapp/outbound";

export async function toggleBot(conversationId: string, active: boolean): Promise<{ error?: string }> {
  const { supabase, organizationId } = await getSession();
  const { error } = await supabase
    .from("conversations")
    .update({ bot_active: active })
    .eq("id", conversationId)
    .eq("organization_id", organizationId);
  if (error) return { error: error.message };
  revalidatePath("/conversaciones", "layout");
  return {};
}

export async function sendHumanMessage(conversationId: string, text: string): Promise<{ error?: string }> {
  const { supabase, organizationId } = await getSession();
  const body = text.trim();
  if (!body) return { error: "Escribe un mensaje." };
  if (body.length > 4096) return { error: "WhatsApp admite hasta 4096 caracteres por mensaje." };

  // RLS garantiza que la conversación es de la organización del usuario
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, contacts(wa_phone)")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!conversation?.contacts) return { error: "No encontramos esta conversación." };

  const credentials = await getWhatsAppCredentials(organizationId);
  if (!credentials) return { error: "Conecta WhatsApp en Integraciones para poder enviar mensajes." };

  try {
    await sendAndRecord({
      credentials,
      conversationId,
      to: conversation.contacts.wa_phone,
      text: body,
      sender: "human",
    });
  } catch (err) {
    return { error: `WhatsApp no aceptó el mensaje: ${errorMessage(err)}` };
  }
  return {};
}
