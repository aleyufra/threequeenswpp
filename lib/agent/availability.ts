import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCalendarAccess } from "@/lib/google/oauth";
import { queryFreeBusy, type BusyInterval } from "@/lib/google/calendar";

// Ocupación = citas activas en BD ∪ FreeBusy de Google Calendar (si está conectado).
export async function getBusyIntervals(organizationId: string, from: Date, to: Date): Promise<BusyInterval[]> {
  const { data, error } = await createAdminClient()
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("organization_id", organizationId)
    .neq("status", "cancelled")
    .lt("starts_at", to.toISOString())
    .gt("ends_at", from.toISOString());
  if (error) throw error;

  const busy: BusyInterval[] = data.map((a) => ({ start: new Date(a.starts_at), end: new Date(a.ends_at) }));

  const google = await getCalendarAccess(organizationId);
  if (google) busy.push(...(await queryFreeBusy(google.accessToken, google.calendarId, from, to)));
  return busy;
}
