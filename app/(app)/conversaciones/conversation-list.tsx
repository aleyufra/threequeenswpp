"use client";

import Link from "next/link";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { useEffect } from "react";
import { avatarColor } from "@/lib/contacts";
import { createClient } from "@/lib/supabase/client";
import { formatInTz } from "@/lib/time";

export type ConversationItem = {
  id: string;
  botActive: boolean;
  lastMessageAt: string | null;
  name: string;
  phone: string;
  lastMessage: string;
  lastSender: string | null;
};

const SENDER_PREFIX: Record<string, string> = { bot: "Asistente: ", human: "Tú: " };

function formatWhen(iso: string | null, timeZone: string) {
  if (!iso) return "";
  const date = new Date(iso);
  const sameDay =
    formatInTz(date, timeZone, { dateStyle: "short" }) === formatInTz(new Date(), timeZone, { dateStyle: "short" });
  return sameDay
    ? formatInTz(date, timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    : formatInTz(date, timeZone, { day: "numeric", month: "short" });
}

export function ConversationList({
  organizationId,
  timezone,
  items,
}: {
  organizationId: string;
  timezone: string;
  items: ConversationItem[];
}) {
  const router = useRouter();
  const selectedId = useSelectedLayoutSegment();

  // Cualquier cambio en conversaciones o mensajes de la organización refresca la lista (Server Component)
  useEffect(() => {
    const supabase = createClient();
    const filter = `organization_id=eq.${organizationId}`;
    const channel = supabase
      .channel(`conversation-list:${organizationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter }, () => router.refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, router]);

  return (
    <aside
      className={`${selectedId ? "hidden md:flex" : "flex"} w-full flex-col border-r border-line bg-paper md:w-80 md:shrink-0`}
    >
      <div className="border-b border-line px-4 py-4">
        <h1 className="font-display text-xl font-semibold tracking-tight">Conversaciones</h1>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-sm text-ink-soft">
          Cuando un cliente escriba a tu WhatsApp, su conversación aparecerá aquí.
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {items.map((item) => {
            const active = item.id === selectedId;
            return (
              <li key={item.id}>
                <Link
                  href={`/conversaciones/${item.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex gap-3 border-b border-line/70 px-4 py-3 ${active ? "bg-haze/60" : "hover:bg-porcelain"}`}
                >
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-full font-display text-base font-semibold ${avatarColor(item.phone || item.id)}`}
                  >
                    {item.name.replace(/^\+/, "").charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{item.name}</span>
                      <span className="shrink-0 text-xs text-ink-soft">{formatWhen(item.lastMessageAt, timezone)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className="truncate text-sm text-ink-soft">
                        {item.lastSender ? SENDER_PREFIX[item.lastSender] ?? "" : ""}
                        {item.lastMessage}
                      </span>
                      {!item.botActive && (
                        <span className="shrink-0 rounded-md bg-amber-soft px-2 py-0.5 text-xs font-medium text-amber">
                          Bot pausado
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
