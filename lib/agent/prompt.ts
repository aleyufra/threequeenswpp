import { WEEKDAY_LABELS, formatInTz, type Weekday } from "@/lib/time";
import type { AgentSettings } from "./config";
import type { AgentContact } from "./context";

const DAY_ORDER: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const yesNo = (v: boolean | null) => (v === null ? "desconocido" : v ? "sí" : "no");

// System prompt = prompt editable del negocio + tono + datos del negocio + contexto + reglas fijas.
export function buildSystemPrompt(params: {
  settings: AgentSettings;
  contact: AgentContact;
  greet: boolean;
  now?: Date;
}): string {
  const { settings, contact, greet } = params;
  const now = params.now ?? new Date();
  const info = settings.businessInfo;
  const tz = settings.timezone;

  const infoLines = [
    `- Nombre: ${info.name || settings.orgName}`,
    info.address && `- Dirección: ${info.address}`,
    info.phones.length === 1 && `- Teléfono del negocio: ${info.phones[0]}`,
    info.phones.length > 1 &&
      `- Teléfonos del negocio (hay ${info.phones.length}; cuando pregunten por un teléfono o cómo contactar, compártelos todos): ${info.phones.join(", ")}`,
    info.cancellation_policy && `- Política de cancelación: ${info.cancellation_policy}`,
  ].filter(Boolean);

  const services = settings.services.length
    ? settings.services
        .map((s) => `- ${s.name} (${s.duration_minutes} min)${s.description ? `: ${s.description}` : ""}`)
        .join("\n")
    : "- (sin servicios configurados: no agendes citas, ofrece pasar con una persona)";

  const hours = DAY_ORDER.map((d) => {
    const ranges = settings.businessHours[d];
    return `- ${WEEKDAY_LABELS[d]}: ${ranges.length ? ranges.map((r) => `${r.start}–${r.end}`).join(", ") : "cerrado"}`;
  }).join("\n");

  const nowLabel = formatInTz(now, tz, { dateStyle: "full", timeStyle: "short" });
  const requiredData = [
    "nombre completo",
    "servicio (de la lista)",
    "horario elegido entre los que devolvió get_available_slots",
    ...(settings.askNewPatient ? ["si es nuevo cliente (sí/no)"] : []),
  ];

  return `${settings.systemPrompt.trim()}

## Tono
Usa un tono ${settings.tone}.

## Información del negocio
${infoLines.join("\n")}
${info.faq ? `\nPreguntas frecuentes, productos y otra información:\n${info.faq}\n` : ""}
## Servicios
${services}

## Horario de atención (zona horaria ${tz})
${hours}

## Contexto actual
- Fecha y hora actual: ${nowLabel} (${tz})
- Teléfono del cliente: ${contact.phone ?? "desconocido"} (ya lo tienes; nunca lo pidas)
- Nombre del cliente: ${contact.fullName ?? "desconocido"}
${settings.askNewPatient ? `- ¿Es nuevo cliente?: ${yesNo(contact.isNewPatient)}\n` : ""}- ${
    greet
      ? "Es el inicio de la conversación (o el cliente retoma tras un tiempo): saluda brevemente y pregunta en qué puedes ayudar, salvo que ya lo haya dicho."
      : "La conversación está en curso: no vuelvas a saludar."
  }

## Cómo agendar una cita
1. Pregunta qué servicio necesita (sólo servicios de la lista).
2. Llama a get_available_slots y ofrece exactamente los horarios que devuelva. Nunca inventes horarios.
3. Antes de reservar necesitas: ${requiredData.join(", ")}. El teléfono ya lo tienes.
4. En cuanto conozcas el nombre${settings.askNewPatient ? " o si es nuevo cliente" : ""}, guárdalo con save_contact_info.
5. Resume la cita y pide confirmación. Con la confirmación, llama a book_appointment usando el starts_at exacto del horario elegido.
6. Si book_appointment responde que el horario ya no está disponible, vuelve a consultar horarios.

## Pasar con una persona
Llama a request_human_handoff si el cliente pide hablar con una persona, si después de intentarlo no entiendes qué necesita, o si la consulta está fuera de lo que puedes resolver. Después de llamarla no escribas nada más.

## Formato
Responde en el idioma del cliente (por defecto español), en texto plano para WhatsApp. Escribe como una persona real chateando: frases naturales y cercanas, sin negritas (*texto*), cursivas, títulos, tablas ni markdown.`;
}
