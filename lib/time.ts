// Helpers de zona horaria basados en Intl (sin dependencias).

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miércoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: Weekday;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatterCache.set(timeZone, fmt);
  }
  return fmt;
}

// Fecha/hora "de reloj" de un instante en la timezone dada.
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts: Record<string, string> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: parts.weekday.slice(0, 3).toLowerCase() as Weekday,
  };
}

// Minutos que la timezone está adelantada (+) o atrasada (-) respecto a UTC en ese instante.
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtc - truncated) / 60000);
}

// Hora de reloj en la timezone → instante UTC (maneja cambios de horario).
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = tzOffsetMinutes(new Date(guess), timeZone);
  let ts = guess - firstOffset * 60000;
  const secondOffset = tzOffsetMinutes(new Date(ts), timeZone);
  if (secondOffset !== firstOffset) ts = guess - secondOffset * 60000;
  return new Date(ts);
}

const pad = (n: number) => String(n).padStart(2, "0");

// ISO 8601 con el offset de la timezone, ej. 2026-11-03T10:00:00-06:00
export function toZonedISO(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  const offset = tzOffsetMinutes(date, timeZone);
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return (
    `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

// Suma días a una fecha de calendario (sin horas).
export function addDays(year: number, month: number, day: number, days: number) {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function weekdayOf(year: number, month: number, day: number): Weekday {
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

// Lunes 00:00 → lunes siguiente 00:00 (exclusivo) de la semana que contiene `now`, en la timezone.
export function weekRange(now: Date, timeZone: string): { start: Date; end: Date } {
  const p = zonedParts(now, timeZone);
  const sinceMonday = (WEEKDAYS.indexOf(p.weekday) + 6) % 7;
  const monday = addDays(p.year, p.month, p.day, -sinceMonday);
  const nextMonday = addDays(monday.year, monday.month, monday.day, 7);
  return {
    start: zonedTimeToUtc(monday.year, monday.month, monday.day, 0, 0, timeZone),
    end: zonedTimeToUtc(nextMonday.year, nextMonday.month, nextMonday.day, 0, 0, timeZone),
  };
}

// "HH:MM" → minutos desde medianoche
export function parseHM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function formatInTz(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone, ...options }).format(date);
}

// "martes 3 de noviembre, 10:00"
export function formatSlotLabel(date: Date, timeZone: string): string {
  return formatInTz(date, timeZone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}
