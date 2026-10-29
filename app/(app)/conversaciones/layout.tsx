import { contactName } from "@/lib/contacts";
import { getSession } from "@/lib/session";
import { ConversationList, type ConversationItem } from "./conversation-list";

export default async function ConversacionesLayout({ children }: { children: React.ReactNode }) {
  const { supabase, organizationId, org } = await getSession();

  const { data } = await supabase
    .from("conversations")
    .select("id, bot_active, last_message_at, contacts(full_name, wa_phone, metadata), messages(content, sender, created_at)")
    .eq("organization_id", organizationId)
    .order("last_message_at", { ascending: false })
    .order("created_at", { referencedTable: "messages", ascending: false })
    .limit(1, { referencedTable: "messages" })
    .limit(100);

  const items: ConversationItem[] = (data ?? []).map((c) => ({
    id: c.id,
    botActive: c.bot_active !== false,
    lastMessageAt: c.last_message_at,
    name: contactName(c.contacts),
    phone: c.contacts?.wa_phone ?? "",
    lastMessage: c.messages[0]?.content ?? "",
    lastSender: c.messages[0]?.sender ?? null,
  }));

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-4rem)] sm:-mx-6 md:-my-8 md:h-dvh lg:-mx-10">
      <ConversationList organizationId={organizationId} timezone={org.timezone} items={items} />
      <section className="flex min-w-0 flex-1 flex-col">{children}</section>
    </div>
  );
}
