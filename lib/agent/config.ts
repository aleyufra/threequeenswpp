import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Weekday } from "@/lib/time";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:MM");

export const timeRangeSchema = z
  .object({ start: hhmm, end: hhmm })
  .refine((r) => r.start < r.end, "La hora de inicio debe ser anterior a la de fin");

export const serviceSchema = z.object({
  name: z.string().trim().min(1, "El servicio necesita nombre"),
  duration_minutes: z.number().int().min(5).max(600),
  description: z.string().default(""),
});

const dayRanges = z.array(timeRangeSchema).catch([]);

export const businessHoursSchema = z.object({
  mon: dayRanges,
  tue: dayRanges,
  wed: dayRanges,
  thu: dayRanges,
  fri: dayRanges,
  sat: dayRanges,
  sun: dayRanges,
});

export const businessInfoSchema = z.object({
  name: z.string().catch(""),
  address: z.string().catch(""),
  phones: z.array(z.string()).catch([]),
  cancellation_policy: z.string().catch(""),
  faq: z.string().catch(""),
});

export type Service = z.infer<typeof serviceSchema>;
export type TimeRange = z.infer<typeof timeRangeSchema>;
export type BusinessHours = Record<Weekday, TimeRange[]>;
export type BusinessInfo = z.infer<typeof businessInfoSchema>;

export type AgentSettings = {
  organizationId: string;
  orgName: string;
  timezone: string;
  systemPrompt: string;
  tone: string;
  businessInfo: BusinessInfo;
  services: Service[];
  businessHours: BusinessHours;
  handoffMessage: string;
  askNewPatient: boolean;
};

// Los jsonb vienen sin tipar: se parsean de forma tolerante (lo inválido se descarta).
export function parseServices(value: unknown): Service[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = serviceSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export function parseBusinessHours(value: unknown): BusinessHours {
  return businessHoursSchema.parse(value && typeof value === "object" ? value : {});
}

export function parseBusinessInfo(value: unknown): BusinessInfo {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  // Configs antiguas guardaban un único `phone`
  const phones = raw.phones ?? (typeof raw.phone === "string" && raw.phone ? [raw.phone] : []);
  return businessInfoSchema.parse({ ...raw, phones });
}

export async function loadAgentSettings(
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<AgentSettings> {
  const [configResult, orgResult] = await Promise.all([
    supabase.from("agent_configs").select("*").eq("organization_id", organizationId).single(),
    supabase.from("organizations").select("name, timezone").eq("id", organizationId).single(),
  ]);
  if (configResult.error) throw configResult.error;
  if (orgResult.error) throw orgResult.error;
  const config = configResult.data;
  const org = orgResult.data;

  return {
    organizationId,
    orgName: org.name,
    timezone: org.timezone,
    systemPrompt: config.system_prompt,
    tone: config.tone,
    businessInfo: parseBusinessInfo(config.business_info),
    services: parseServices(config.services),
    businessHours: parseBusinessHours(config.business_hours),
    handoffMessage: config.handoff_message || "Te paso con un humano en un momento.",
    askNewPatient: config.ask_new_patient,
  };
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export function findService(services: Service[], name: string): Service | undefined {
  const target = normalize(name);
  return (
    services.find((s) => normalize(s.name) === target) ??
    services.find((s) => normalize(s.name).includes(target) || target.includes(normalize(s.name)))
  );
}
