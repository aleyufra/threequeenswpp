// Cliente mínimo de Google Calendar API v3 con fetch (sin googleapis).

const BASE = "https://www.googleapis.com/calendar/v3";

export type BusyInterval = { start: Date; end: Date };

export type CalendarEventInput = {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  timeZone: string;
  colorId?: string;
};

async function googleFetch<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  // DELETE de un evento que ya no existe cuenta como éxito
  if (res.status === 204 || (init.method === "DELETE" && (res.status === 404 || res.status === 410))) {
    return undefined as T;
  }
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Google Calendar (${res.status}): ${json.error?.message ?? "error"}`);
  return json;
}

const cal = (calendarId: string) => `/calendars/${encodeURIComponent(calendarId)}`;

export async function queryFreeBusy(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<BusyInterval[]> {
  const json = await googleFetch<{
    calendars: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason: string }[] }>;
  }>(accessToken, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: calendarId }],
    }),
  });
  const entry = json.calendars[calendarId];
  if (entry?.errors?.length) throw new Error(`FreeBusy: ${entry.errors[0].reason}`);
  return (entry?.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

function toEventBody(event: Partial<CalendarEventInput>) {
  return {
    summary: event.summary,
    description: event.description,
    colorId: event.colorId,
    start: event.start && { dateTime: event.start.toISOString(), timeZone: event.timeZone },
    end: event.end && { dateTime: event.end.toISOString(), timeZone: event.timeZone },
  };
}

export async function insertEvent(accessToken: string, calendarId: string, event: CalendarEventInput) {
  return googleFetch<{ id: string; htmlLink: string }>(accessToken, `${cal(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify(toEventBody(event)),
  });
}

export async function patchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  patch: Partial<CalendarEventInput>,
) {
  return googleFetch<{ id: string }>(accessToken, `${cal(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(toEventBody(patch)),
  });
}

export async function deleteEvent(accessToken: string, calendarId: string, eventId: string) {
  await googleFetch<void>(accessToken, `${cal(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  });
}

export async function listCalendars(accessToken: string) {
  const json = await googleFetch<{ items?: { id: string; summary: string; primary?: boolean }[] }>(
    accessToken,
    "/users/me/calendarList?minAccessRole=writer",
  );
  return json.items ?? [];
}
