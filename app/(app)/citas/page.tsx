import { getSession } from "@/lib/session";
import { WEEKDAYS, addDays, weekdayOf, zonedParts, zonedTimeToUtc } from "@/lib/time";
import { pageTitleClass } from "@/components/ui";
import { CalendarView, type CalendarAppointment, type Ymd } from "./calendar-view";

type View = "month" | "week";

const toKey = (d: Ymd) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

function parseKey(value: string | undefined): Ymd | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
}

// días transcurridos desde el lunes (lunes = 0)
const sinceMonday = (d: Ymd) => (WEEKDAYS.indexOf(weekdayOf(d.year, d.month, d.day)) + 6) % 7;
const mondayOf = (d: Ymd) => addDays(d.year, d.month, d.day, -sinceMonday(d));

export default async function CitasPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { supabase, organizationId, org } = await getSession();
  const params = await searchParams;
  const view: View = params.view === "week" ? "week" : "month";
  const tz = org.timezone;
  const now = zonedParts(new Date(), tz);
  const today: Ymd = { year: now.year, month: now.month, day: now.day };
  const anchor = parseKey(params.date) ?? today;

  // Rango visible: semana (lun–dom) o mes completo en semanas enteras
  let gridStart: Ymd;
  let dayCount: number;
  let prev: Ymd;
  let next: Ymd;
  if (view === "week") {
    gridStart = mondayOf(anchor);
    dayCount = 7;
    prev = addDays(gridStart.year, gridStart.month, gridStart.day, -7);
    next = addDays(gridStart.year, gridStart.month, gridStart.day, 7);
  } else {
    const first = { year: anchor.year, month: anchor.month, day: 1 };
    const daysInMonth = new Date(Date.UTC(anchor.year, anchor.month, 0)).getUTCDate();
    gridStart = mondayOf(first);
    dayCount = Math.ceil((sinceMonday(first) + daysInMonth) / 7) * 7;
    prev = anchor.month === 1 ? { year: anchor.year - 1, month: 12, day: 1 } : { year: anchor.year, month: anchor.month - 1, day: 1 };
    next = anchor.month === 12 ? { year: anchor.year + 1, month: 1, day: 1 } : { year: anchor.year, month: anchor.month + 1, day: 1 };
  }

  const gridEnd = addDays(gridStart.year, gridStart.month, gridStart.day, dayCount);
  const rangeStart = zonedTimeToUtc(gridStart.year, gridStart.month, gridStart.day, 0, 0, tz);
  const rangeEnd = zonedTimeToUtc(gridEnd.year, gridEnd.month, gridEnd.day, 0, 0, tz);

  const { data } = await supabase
    .from("appointments")
    .select("id, service, starts_at, ends_at, status, full_name, phone, is_new_patient, notes")
    .eq("organization_id", organizationId)
    .gte("starts_at", rangeStart.toISOString())
    .lt("starts_at", rangeEnd.toISOString())
    .order("starts_at");

  const href = (v: View, d: Ymd) => `/citas?view=${v}&date=${toKey(d)}`;

  return (
    <div>
      <h1 className={pageTitleClass}>Citas</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Las citas que agenda el asistente aparecen aquí y en tu Google Calendar. Abre una para marcarla como completada o cancelarla.
      </p>
      <CalendarView
        view={view}
        anchor={anchor}
        today={today}
        gridStart={gridStart}
        dayCount={dayCount}
        timezone={tz}
        appointments={(data ?? []) as CalendarAppointment[]}
        links={{
          prev: href(view, prev),
          next: href(view, next),
          today: href(view, today),
          month: href("month", anchor),
          week: href("week", anchor),
        }}
      />
    </div>
  );
}
