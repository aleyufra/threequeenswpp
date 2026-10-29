import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCalendarAccess } from "@/lib/google/oauth";
import { deleteEvent, insertEvent } from "@/lib/google/calendar";
import { formatSlotLabel, toZonedISO } from "@/lib/time";
import { getBusyIntervals } from "../availability";
import { findService } from "../config";
import type { AgentContext } from "../context";
import { fitsBusinessHours, overlaps } from "../slots";

export function bookAppointmentTool(ctx: AgentContext) {
  return tool({
    description:
      "Agenda la cita (Google Calendar + registro interno). Llámala sólo cuando tengas todos los datos y el cliente haya confirmado el horario.",
    inputSchema: z.object({
      full_name: z.string().min(2).describe("Nombre completo del cliente"),
      service: z.string().describe("Servicio elegido, de la lista de servicios"),
      starts_at: z.string().describe("starts_at exacto (ISO 8601) de uno de los horarios devueltos por get_available_slots"),
      is_new_patient: z.boolean().optional().describe("Si es la primera vez que viene"),
    }),
    execute: async ({ full_name, service, starts_at, is_new_patient }) => {
      const { settings, contact } = ctx;
      const tz = settings.timezone;

      const svc = findService(settings.services, service);
      if (!svc) {
        return { ok: false, error: `Servicio desconocido. Opciones: ${settings.services.map((s) => s.name).join(", ")}` };
      }
      if (settings.askNewPatient && is_new_patient === undefined) {
        return { ok: false, error: "Falta preguntar si es nuevo cliente (sí/no)." };
      }

      const start = new Date(starts_at);
      if (Number.isNaN(start.getTime())) return { ok: false, error: "starts_at no es una fecha ISO válida." };
      const end = new Date(start.getTime() + svc.duration_minutes * 60_000);
      if (start.getTime() < Date.now()) return { ok: false, error: "Ese horario ya pasó." };
      if (!fitsBusinessHours(settings.businessHours, tz, start, svc.duration_minutes)) {
        return { ok: false, error: "Ese horario está fuera del horario de atención. Consulta get_available_slots." };
      }

      const label = formatSlotLabel(start, tz);
      if (ctx.mode === "sandbox") {
        return { ok: true, simulated: true, service: svc.name, starts_at: toZonedISO(start, tz), label };
      }
      if (!contact.id || !contact.phone) throw new Error("book_appointment requiere un contacto");

      const supabase = createAdminClient();
      const orgId = settings.organizationId;

      // Idempotencia: misma cita para el mismo contacto y horario
      const { data: existing } = await supabase
        .from("appointments")
        .select("id")
        .eq("organization_id", orgId)
        .eq("contact_id", contact.id)
        .eq("starts_at", start.toISOString())
        .neq("status", "cancelled")
        .maybeSingle();
      if (existing) return { ok: true, already_booked: true, appointment_id: existing.id, label };

      const busy = await getBusyIntervals(orgId, start, end);
      if (overlaps(start, end, busy)) {
        return { ok: false, error: "Ese horario ya no está disponible. Vuelve a consultar get_available_slots." };
      }

      const google = await getCalendarAccess(orgId);
      let googleEventId: string | null = null;
      if (google) {
        const event = await insertEvent(google.accessToken, google.calendarId, {
          summary: `${svc.name} · ${full_name}`,
          description: [
            `Cliente: ${full_name}`,
            `Teléfono: ${contact.phone}`,
            is_new_patient === undefined ? null : `Nuevo cliente: ${is_new_patient ? "sí" : "no"}`,
            "Agendada por el asistente de WhatsApp",
          ]
            .filter(Boolean)
            .join("\n"),
          start,
          end,
          timeZone: tz,
        });
        googleEventId = event.id;
      }

      const { data: appointment, error } = await supabase
        .from("appointments")
        .insert({
          organization_id: orgId,
          contact_id: contact.id,
          service: svc.name,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          google_event_id: googleEventId,
          status: "confirmed",
          is_new_patient: is_new_patient ?? null,
          full_name,
          phone: contact.phone,
        })
        .select("id")
        .single();

      if (error) {
        if (google && googleEventId) {
          await deleteEvent(google.accessToken, google.calendarId, googleEventId).catch(() => undefined);
        }
        if (error.code === "23505") return { ok: true, already_booked: true, label };
        throw error;
      }

      await supabase
        .from("contacts")
        .update({ full_name, ...(is_new_patient !== undefined && { is_new_patient }) })
        .eq("id", contact.id)
        .eq("organization_id", orgId);

      return { ok: true, appointment_id: appointment.id, service: svc.name, starts_at: toZonedISO(start, tz), label };
    },
  });
}
