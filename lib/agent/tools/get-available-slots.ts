import { tool } from "ai";
import { z } from "zod";
import { formatSlotLabel, toZonedISO } from "@/lib/time";
import { getBusyIntervals } from "../availability";
import { findService } from "../config";
import type { AgentContext } from "../context";
import { computeSlots } from "../slots";

const MIN_LEAD_MINUTES = 60;

export function getAvailableSlotsTool(ctx: AgentContext) {
  return tool({
    description:
      "Devuelve 3 horarios libres reales para un servicio en los próximos días. Úsala siempre antes de proponer horarios; nunca inventes horarios.",
    inputSchema: z.object({
      service: z.string().describe("Nombre del servicio, tal como aparece en la lista de servicios"),
      days_ahead: z.number().int().min(1).max(30).optional().describe("Días hacia adelante a buscar (por defecto 7)"),
    }),
    execute: async ({ service, days_ahead }) => {
      const { settings } = ctx;
      const svc = findService(settings.services, service);
      if (!svc) {
        return {
          ok: false,
          error: `Servicio no encontrado. Servicios disponibles: ${settings.services.map((s) => s.name).join(", ")}`,
        };
      }

      const days = days_ahead ?? 7;
      const from = new Date(Date.now() + MIN_LEAD_MINUTES * 60_000);
      const to = new Date(from.getTime() + (days + 1) * 24 * 60 * 60_000);
      const busy = await getBusyIntervals(settings.organizationId, from, to);
      const slots = computeSlots({
        businessHours: settings.businessHours,
        timeZone: settings.timezone,
        durationMinutes: svc.duration_minutes,
        busy,
        from,
        days,
      });

      if (slots.length === 0) {
        return { ok: true, service: svc.name, slots: [], note: "No hay horarios libres en ese rango. Prueba con más días." };
      }
      return {
        ok: true,
        service: svc.name,
        duration_minutes: svc.duration_minutes,
        timezone: settings.timezone,
        slots: slots.map((s) => ({
          starts_at: toZonedISO(s, settings.timezone),
          label: formatSlotLabel(s, settings.timezone),
        })),
      };
    },
  });
}
