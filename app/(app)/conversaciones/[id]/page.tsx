import { notFound } from "next/navigation";
import { contactName } from "@/lib/contacts";
import { getSession } from "@/lib/session";
import { Chat, type ChatMessage } from "./chat";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId, org } = await getSession();

  const [{ data: conversation }, { data: messages }, { count: whatsappConfigured }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, bot_active, contacts(full_name, wa_phone, is_new_patient, metadata)")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("id, direction, sender, content, created_at")
      .eq("conversation_id", id)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("whatsapp_configs")
      .select("organization_id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
  ]);

  if (!conversation) notFound();

  return (
    <Chat
      key={conversation.id}
      conversationId={conversation.id}
      initialBotActive={conversation.bot_active !== false}
      contact={{
        name: contactName(conversation.contacts),
        phone: conversation.contacts?.wa_phone ?? "",
        isNewPatient: conversation.contacts?.is_new_patient ?? null,
      }}
      initialMessages={((messages ?? []) as ChatMessage[]).reverse()}
      timezone={org.timezone}
      canSend={Boolean(whatsappConfigured)}
    />
  );
}
