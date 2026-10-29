"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { errorMessage } from "@/lib/log";
import { getCalendarAccess } from "@/lib/google/oauth";
import { deleteEvent, patchEvent } from "@/lib/google/calendar";

const GOOGLE_COLOR_SAGE = "2";

export async function updateAppointmentStatus(
  appointmentId: string,
  status: "cancelled" | "completed",
): Promise<{ error?: string; warning?: string }> {
  const { supabase, organizationId } = await getSession();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, service, full_name, google_event_id")
    .eq("id", appointmentId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!appointment) return { error: "No encontramos la cita." };

  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId)
    .eq("organization_id", organizationId);
  if (error) return { error: error.message };

  // Sincroniza con Google Calendar: cancelada → se borra el evento; completada → ✓ y color verde
  let warning: string | undefined;
  if (appointment.google_event_id) {
    try {
      const google = await getCalendarAccess(organizationId);
      if (google) {
        if (status === "cancelled") {
          await deleteEvent(google.accessToken, google.calendarId, appointment.google_event_id);
        } else {
          await patchEvent(google.accessToken, google.calendarId, appointment.google_event_id, {
            summary: `✓ ${appointment.service} · ${appointment.full_name}`,
            colorId: GOOGLE_COLOR_SAGE,
          });
        }
      }
    } catch (err) {
      warning = `La cita se actualizó, pero Google Calendar no respondió: ${errorMessage(err)}`;
    }
  }

  revalidatePath("/citas");
  revalidatePath("/dashboard");
  return { warning };
}
