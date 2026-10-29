import { ChatsTeardrop } from "@phosphor-icons/react/ssr";

export default function ConversacionesPage() {
  return (
    <div className="hidden flex-1 flex-col items-center justify-center gap-3 px-6 text-center md:flex">
      <ChatsTeardrop size={40} className="text-ink-soft/50" />
      <p className="max-w-xs text-sm text-ink-soft">
        Elige una conversación para leerla, responder como persona o pausar al asistente.
      </p>
    </div>
  );
}
