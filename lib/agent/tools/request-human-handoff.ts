import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAndRecord } from "@/lib/whatsapp/outbound";
import { log } from "@/lib/log";
import type { AgentContext } from "../context";

export function requestHumanHandoffTool(ctx: AgentContext) {
  return tool({
    description:
      "Pasa la conversación a una persona del equipo y desactiva el bot en este hilo. Úsala si el cliente lo pide o si no logras entender o resolver su solicitud. No escribas nada después de llamarla.",
    inputSchema: z.object({
      reason: z.string().optional().describe("Motivo breve del traspaso, para el equipo"),
    }),
    execute: async ({ reason }) => {
      ctx.state.handoff = true;
      const message = ctx.settings.handoffMessage;

      if (ctx.mode === "sandbox") return { ok: true, simulated: true, message_sent_to_customer: message };
      if (!ctx.conversationId || !ctx.contact.phone || !ctx.whatsapp) {
        throw new Error("request_human_handoff requiere una conversación de WhatsApp");
      }

      // El dashboard recibe este UPDATE por Supabase Realtime y avisa al dueño.
      const { error } = await createAdminClient()
        .from("conversations")
        .update({ bot_active: false })
        .eq("id", ctx.conversationId)
        .eq("organization_id", ctx.settings.organizationId);
      if (error) throw error;

      await sendAndRecord({
        credentials: ctx.whatsapp,
        conversationId: ctx.conversationId,
        to: ctx.contact.phone,
        text: message,
        sender: "bot",
        raw: { handoff_reason: reason ?? null },
      });

      log("info", "agent.handoff", {
        organization_id: ctx.settings.organizationId,
        conversation_id: ctx.conversationId,
        reason,
      });
      // TODO: notificar también al dueño por email / push (por ahora sólo aviso en el dashboard vía Realtime).

      return { ok: true, message_sent_to_customer: message };
    },
  });
}
