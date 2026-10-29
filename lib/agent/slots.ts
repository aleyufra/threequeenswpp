import type { BusyInterval } from "@/lib/google/calendar";
import { addDays, parseHM, weekdayOf, zonedParts, zonedTimeToUtc } from "@/lib/time";
import type { BusinessHours } from "./config";

const STEP_MINUTES = 30;

export function overlaps(start: Date, end: Date, busy: BusyInterval[]): boolean {
  return busy.some((b) => start < b.end && end > b.start);
}

// Huecos libres dentro del horario de atención. Devuelve `count` slots repartidos en días distintos
// (alternando mañana / mediodía / tarde) y completa con más huecos si hay pocos días disponibles.
export function computeSlots(opts: {
  businessHours: BusinessHours;
  timeZone: string;
  durationMinutes: number;
  busy: BusyInterval[];
  from: Date;
  days: number;
  count?: number;
}): Date[] {
  const { businessHours, timeZone, durationMinutes, busy, from, days, count = 3 } = opts;
  const today = zonedParts(from, timeZone);
  const perDay: Date[][] = [];

  for (let i = 0; i <= days; i++) {
    const d = addDays(today.year, today.month, today.day, i);
    const ranges = businessHours[weekdayOf(d.year, d.month, d.day)] ?? [];
    const daySlots: Date[] = [];
    for (const range of ranges) {
      const endMinute = parseHM(range.end);
      for (let m = parseHM(range.start); m + durationMinutes <= endMinute; m += STEP_MINUTES) {
        const start = zonedTimeToUtc(d.year, d.month, d.day, Math.floor(m / 60), m % 60, timeZone);
        const end = new Date(start.getTime() + durationMinutes * 60_000);
        if (start < from || overlaps(start, end, busy)) continue;
        daySlots.push(start);
      }
    }
    if (daySlots.length) perDay.push(daySlots);
  }

  const picked: Date[] = [];
  perDay.forEach((slots, i) => {
    if (picked.length < count) picked.push(slots[Math.floor((slots.length * (i % 3)) / 3)]);
  });
  for (const slots of perDay) {
    for (const slot of slots) {
      if (picked.length >= count) break;
      if (!picked.some((p) => p.getTime() === slot.getTime())) picked.push(slot);
    }
  }
  return picked.sort((a, b) => a.getTime() - b.getTime());
}

export function fitsBusinessHours(
  businessHours: BusinessHours,
  timeZone: string,
  start: Date,
  durationMinutes: number,
): boolean {
  const p = zonedParts(start, timeZone);
  const startMinute = p.hour * 60 + p.minute;
  const endMinute = startMinute + durationMinutes;
  return (businessHours[p.weekday] ?? []).some(
    (r) => parseHM(r.start) <= startMinute && endMinute <= parseHM(r.end),
  );
}
