"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, PaperPlaneRight, Robot, User } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { formatInTz } from "@/lib/time";
import { sendHumanMessage, toggleBot } from "../actions";

export type ChatMessage = {
  id: string;
  direction: string;
  sender: string;
  content: string | null;
  created_at: string | null;
};

type Props = {
  conversationId: string;
  initialBotActive: boolean;
  contact: { name: string; phone: string; isNewPatient: boolean | null };
  initialMessages: ChatMessage[];
  timezone: string;
  canSend: boolean;
};

export function Chat({ conversationId, initialBotActive, contact, initialMessages, timezone, canSend }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [botActive, setBotActive] = useState(initialBotActive);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const [toggling, startToggling] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Realtime por conversation_id: mensajes nuevos y cambios del toggle
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` },
        (payload) => setBotActive((payload.new as { bot_active: boolean | null }).bot_active !== false),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function onToggle() {
    const next = !botActive;
    setBotActive(next);
    startToggling(async () => {
      const result = await toggleBot(conversationId, next);
      if (result.error) {
        setBotActive(!next);
        setError(result.error);
      }
    });
  }

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setError(null);
    startSending(async () => {
      const result = await sendHumanMessage(conversationId, text);
      if (result.error) setError(result.error);
      else setDraft("");
    });
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line bg-paper px-4 py-3">
        <Link href="/conversaciones" className="rounded-lg p-1.5 text-ink-soft hover:bg-ink/5 md:hidden">
          <ArrowLeft size={20} />
          <span className="sr-only">Volver a conversaciones</span>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{contact.name}</p>
          <p className="truncate text-xs text-ink-soft">
            {contact.phone}
            {contact.isNewPatient !== null && (contact.isNewPatient ? " · cliente nuevo" : " · ya es cliente")}
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-3 select-none">
          <span className="hidden text-right sm:block">
            <span className="block text-sm font-medium text-ink">Bot activo</span>
            <span className={`block text-xs ${botActive ? "text-royal" : "text-amber"}`}>
              {botActive ? "Responde solo" : "Pausado: respondes tú"}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={botActive}
            aria-label="Bot activo"
            disabled={toggling}
            onClick={onToggle}
            className={`relative h-7 w-12 rounded-full transition-colors ${botActive ? "bg-royal" : "bg-amber"} disabled:opacity-70`}
          >
            <span
              className={`absolute top-1 left-1 grid size-5 place-items-center rounded-full bg-white shadow transition-transform ${
                botActive ? "translate-x-5" : ""
              }`}
            >
              {botActive ? <Robot size={12} weight="fill" className="text-royal" /> : <User size={12} weight="fill" className="text-amber" />}
            </span>
          </button>
        </label>
      </header>

      <div className="flex-1 overflow-y-auto bg-porcelain px-4 py-6 sm:px-8">
        <ol className="mx-auto flex max-w-3xl flex-col gap-3">
          {messages.map((m) => (
            <Bubble key={m.id} message={m} timezone={timezone} />
          ))}
        </ol>
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSend} className="border-t border-line bg-paper px-4 py-3">
        {error && (
          <p role="alert" className="mx-auto mb-2 max-w-3xl rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) onSend(e);
            }}
            rows={1}
            disabled={!canSend || sending}
            placeholder={canSend ? "Escribe como persona del equipo…" : "Conecta WhatsApp en Integraciones para responder"}
            aria-label="Mensaje"
            className="max-h-40 min-h-10 flex-1 resize-none rounded-xl border border-line bg-porcelain px-3 py-2 text-sm text-ink focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!canSend || sending || !draft.trim()}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-white hover:bg-royal-dark disabled:opacity-40"
          >
            <PaperPlaneRight size={18} weight="fill" />
            <span className="sr-only">Enviar</span>
          </button>
        </div>
        {botActive && canSend && (
          <p className="mx-auto mt-2 max-w-3xl text-xs text-ink-soft">
            El asistente sigue activo y responderá al próximo mensaje del cliente. Páusalo si vas a atender tú.
          </p>
        )}
      </form>
    </>
  );
}

function Bubble({ message, timezone }: { message: ChatMessage; timezone: string }) {
  const inbound = message.direction === "inbound";
  const isBot = message.sender === "bot";
  const time = message.created_at
    ? formatInTz(new Date(message.created_at), timezone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    : "";

  return (
    <li className={`flex flex-col ${inbound ? "items-start" : "items-end"}`}>
      {!inbound && (
        <span className={`mb-1 flex items-center gap-1 text-xs font-medium ${isBot ? "text-royal" : "text-ink-soft"}`}>
          {isBot ? <Robot size={14} weight="fill" /> : <User size={14} weight="fill" />}
          {isBot ? "Asistente" : "Equipo"}
        </span>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap sm:max-w-[70%] ${
          inbound
            ? "rounded-tl-sm border border-line bg-paper text-ink"
            : isBot
              ? "rounded-tr-sm bg-haze text-ink"
              : "rounded-tr-sm bg-ink text-white"
        }`}
      >
        {message.content}
        <span className={`mt-1 block text-right text-[11px] ${!inbound && !isBot ? "text-white/60" : "text-ink-soft"}`}>
          {time}
        </span>
      </div>
    </li>
  );
}
