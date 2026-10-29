"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { errorMessage, log } from "@/lib/log";
import { loadAgentSettings, serviceSchema, timeRangeSchema } from "@/lib/agent/config";
import type { AgentContext } from "@/lib/agent/context";
import { HISTORY_LIMIT, toModelMessages } from "@/lib/agent/history";
import { runAgent, type AgentRunResult } from "@/lib/agent/run";
import type { FormState } from "@/components/form-message";

function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const ranges = z.array(timeRangeSchema);

const configSchema = z.object({
  system_prompt: z.string().trim().min(20, "El prompt del asistente es demasiado corto."),
  tone: z.string().trim().min(2, "Indica un tono de voz."),
  handoff_message: z.string().trim().min(2, "Escribe el mensaje para pasar con una persona."),
  ask_new_patient: z.boolean(),
  timezone: z.string().refine(isValidTimeZone, "La zona horaria no es válida (ej. America/Mexico_City)."),
  business_info: z.object({
    name: z.string().trim(),
    address: z.string().trim(),
    phones: z.array(z.string().trim()).transform((list) => list.filter(Boolean)),
    cancellation_policy: z.string().trim(),
    faq: z.string().trim(),
  }),
  services: z.array(serviceSchema).min(1, "Agrega al menos un servicio."),
  business_hours: z.object({ mon: ranges, tue: ranges, wed: ranges, thu: ranges, fri: ranges, sat: ranges, sun: ranges }),
});

export type AgentConfigPayload = z.infer<typeof configSchema>;

export async function saveAgentConfig(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, organizationId } = await getSession();

  let json: unknown;
  try {
    json = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "No se pudo leer el formulario." };
  }
  const parsed = configSchema.safeParse(json);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los campos." };
  const { timezone, ...config } = parsed.data;

  const [configResult, orgResult] = await Promise.all([
    supabase.from("agent_configs").update(config).eq("organization_id", organizationId),
    supabase.from("organizations").update({ timezone }).eq("id", organizationId),
  ]);
  const error = configResult.error ?? orgResult.error;
  if (error) return { error: error.message };

  revalidatePath("/personalizacion");
  return { ok: true, message: "Cambios guardados. El asistente los usa desde el próximo mensaje." };
}

const historySchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
  .min(1)
  .max(40);

export type SandboxResult = {
  reply?: string;
  handoff?: boolean;
  toolCalls?: AgentRunResult["toolCalls"];
  error?: string;
};

// Sandbox: misma configuración guardada y mismas tools, pero sin WhatsApp ni escrituras en BD.
export async function testAgent(history: { role: "user" | "assistant"; content: string }[]): Promise<SandboxResult> {
  const { supabase, organizationId } = await getSession();
  const parsed = historySchema.safeParse(history);
  if (!parsed.success) return { error: "Conversación inválida." };

  try {
    const settings = await loadAgentSettings(supabase, organizationId);
    const ctx: AgentContext = {
      mode: "sandbox",
      settings,
      contact: { id: null, phone: "+5215500000000", fullName: null, isNewPatient: null },
      conversationId: null,
      whatsapp: null,
      state: { handoff: false },
    };
    const result = await runAgent({
      ctx,
      messages: toModelMessages(
        parsed.data.slice(-HISTORY_LIMIT).map((m) => ({ direction: m.role === "user" ? "inbound" : "outbound", content: m.content })),
      ),
      greet: parsed.data.filter((m) => m.role === "user").length === 1,
    });
    return {
      reply: result.handoff ? settings.handoffMessage : result.text,
      handoff: result.handoff,
      toolCalls: result.toolCalls,
    };
  } catch (err) {
    log("error", "agent.sandbox_failed", { organization_id: organizationId, error: errorMessage(err) });
    return { error: "El asistente no pudo responder. Revisa ANTHROPIC_API_KEY y vuelve a intentarlo." };
  }
}
