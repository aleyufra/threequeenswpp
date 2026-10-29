import type { ModelMessage } from "ai";

type HistoryRow = { direction: string; content: string | null };

// Últimos mensajes que ve el agente; los datos clave del cliente persisten vía save_contact_info.
export const HISTORY_LIMIT = 10;

// Mensajes de la BD (en orden cronológico) → ModelMessage[].
// inbound = user; outbound (bot o humano) = assistant. Une turnos consecutivos del mismo rol
// y descarta los assistant iniciales (Anthropic exige que el primer mensaje sea del usuario).
export function toModelMessages(rows: HistoryRow[]): ModelMessage[] {
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  for (const row of rows) {
    const content = row.content?.trim();
    if (!content) continue;
    const role = row.direction === "inbound" ? "user" : "assistant";
    const last = turns.at(-1);
    if (last?.role === role) last.content += `\n${content}`;
    else turns.push({ role, content });
  }
  while (turns[0]?.role === "assistant") turns.shift();
  return turns;
}
