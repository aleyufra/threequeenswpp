import type { BusinessHours, Service } from "./config";

// Plantilla por defecto (clínica dental). Mantener sincronizada con private.handle_new_user() en la migración.

export const DEFAULT_SYSTEM_PROMPT = `Eres el asistente virtual de una clínica dental y atiendes a los clientes por WhatsApp.
Tu objetivo es resolver dudas sobre la clínica y agendar citas.

- Escribe mensajes breves (2 a 4 líneas), claros y aptos para WhatsApp.
- Si el cliente quiere una cita, pregunta qué servicio necesita, ofrécele horarios disponibles y recoge sus datos.
- No des diagnósticos ni indicaciones médicas. Si describe dolor intenso o una urgencia, recomiéndale acudir de inmediato y ofrece pasarle con una persona del equipo.
- Si no sabes algo, no lo inventes: ofrece pasarle con una persona del equipo.`;

export const DEFAULT_SERVICES: Service[] = [
  { name: "Limpieza", duration_minutes: 45, description: "Limpieza dental profesional" },
  { name: "Empaste", duration_minutes: 60, description: "Tratamiento de caries con resina" },
  { name: "Blanqueamiento", duration_minutes: 90, description: "Blanqueamiento dental en consultorio" },
];

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  mon: [{ start: "09:00", end: "18:00" }],
  tue: [{ start: "09:00", end: "18:00" }],
  wed: [{ start: "09:00", end: "18:00" }],
  thu: [{ start: "09:00", end: "18:00" }],
  fri: [{ start: "09:00", end: "18:00" }],
  sat: [{ start: "09:00", end: "14:00" }],
  sun: [],
};

export const TONE_PRESETS = [
  "profesional y cálido",
  "cercano y amigable",
  "formal",
  "breve y directo",
  "divertido y con emojis",
];
