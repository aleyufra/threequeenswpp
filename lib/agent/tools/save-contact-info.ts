import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentContext } from "../context";

export function saveContactInfoTool(ctx: AgentContext) {
  return tool({
    description: "Guarda datos del cliente en cuanto los conozcas (nombre completo y/o si es nuevo cliente).",
    inputSchema: z.object({
      full_name: z.string().min(2).optional(),
      is_new_patient: z.boolean().optional(),
    }),
    execute: async ({ full_name, is_new_patient }) => {
      const update = {
        ...(full_name !== undefined && { full_name }),
        ...(is_new_patient !== undefined && { is_new_patient }),
      };
      if (Object.keys(update).length === 0) return { ok: false, error: "No hay datos que guardar." };

      // Mantiene el contexto al día para el resto de la ejecución
      if (full_name !== undefined) ctx.contact.fullName = full_name;
      if (is_new_patient !== undefined) ctx.contact.isNewPatient = is_new_patient;

      if (ctx.mode === "sandbox" || !ctx.contact.id) return { ok: true, simulated: ctx.mode === "sandbox" };

      const { error } = await createAdminClient()
        .from("contacts")
        .update(update)
        .eq("id", ctx.contact.id)
        .eq("organization_id", ctx.settings.organizationId);
      if (error) throw error;
      return { ok: true };
    },
  });
}
