"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowClockwise, Flask, PaperPlaneRight, Robot, X } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui";
import { testAgent } from "./actions";

type Turn = { role: "user" | "assistant"; content: string; notes?: string[] };

const TOOL_LABELS: Record<string, string> = {
  get_available_slots: "Consultó horarios disponibles",
  book_appointment: "Agendó la cita (simulación)",
  save_contact_info: "Guardó datos del cliente (simulación)",
  request_human_handoff: "Pasó la conversación a una persona (simulación)",
};

export function Sandbox() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [turns.length, pending]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setDraft("");
    setError(null);
    startTransition(async () => {
      const result = await testAgent(next.map(({ role, content }) => ({ role, content })));
      if (result.error) {
        setError(result.error);
        return;
      }
      const notes = (result.toolCalls ?? []).map((t) => `${TOOL_LABELS[t.name] ?? t.name}${t.ok ? "" : " — falló"}`);
      if (result.reply) setTurns((prev) => [...prev, { role: "assistant", content: result.reply!, notes }]);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass.secondary}>
        <Flask size={18} />
        Probar agente
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sandbox-title"
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-md flex-col bg-paper shadow-2xl"
          >
            <header className="flex items-start gap-3 border-b border-line px-4 py-3">
              <div className="flex-1">
                <h2 id="sandbox-title" className="text-lg font-semibold">Probar agente</h2>
                <p className="text-xs text-ink-soft">
                  Escribe como si fueras un cliente. Usa la configuración guardada y no envía nada por WhatsApp ni agenda citas reales.
                </p>
              </div>
              <button type="button" onClick={() => setTurns([])} className={buttonClass.ghost} title="Reiniciar conversación">
                <ArrowClockwise size={18} />
                <span className="sr-only">Reiniciar conversación</span>
              </button>
              <button type="button" onClick={() => setOpen(false)} className={buttonClass.ghost}>
                <X size={18} />
                <span className="sr-only">Cerrar</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto bg-porcelain px-4 py-4">
              {turns.length === 0 && (
                <p className="mt-8 text-center text-sm text-ink-soft">Prueba con «Hola, quiero agendar una limpieza».</p>
              )}
              <ol className="flex flex-col gap-3">
                {turns.map((turn, i) => (
                  <li key={i} className={`flex flex-col ${turn.role === "user" ? "items-end" : "items-start"}`}>
                    {turn.notes?.map((note) => (
                      <span key={note} className="mb-1 text-xs text-ink-soft">{note}</span>
                    ))}
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                        turn.role === "user" ? "rounded-tr-sm bg-ink text-white" : "rounded-tl-sm bg-haze text-ink"
                      }`}
                    >
                      {turn.role === "assistant" && <Robot size={14} weight="fill" className="mb-1 text-royal" />}
                      {turn.content}
                    </div>
                  </li>
                ))}
                {pending && <li className="text-xs text-ink-soft">El asistente está escribiendo…</li>}
              </ol>
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="border-t border-line px-4 py-3">
              {error && <p role="alert" className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Escribe un mensaje…"
                  aria-label="Mensaje de prueba"
                  className="min-w-0 flex-1 rounded-xl border border-line bg-porcelain px-3 py-2 text-sm focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20"
                />
                <button
                  type="submit"
                  disabled={pending || !draft.trim()}
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-white hover:bg-royal-dark disabled:opacity-40"
                >
                  <PaperPlaneRight size={18} weight="fill" />
                  <span className="sr-only">Enviar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
