"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { CaretLeft, CaretRight, CheckCircle, Phone, WhatsappLogo, X, XCircle } from "@phosphor-icons/react";
import { addDays, formatInTz, zonedParts } from "@/lib/time";
import { buttonClass } from "@/components/ui";
import { updateAppointmentStatus } from "./actions";

export type Ymd = { year: number; month: number; day: number };

export type CalendarAppointment = {
  id: string;
  service: string;
  starts_at: string;
  ends_at: string;
  status: string | null;
  full_name: string;
  phone: string;
  is_new_patient: boolean | null;
  notes: string | null;
};

const DAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const STATUS: Record<string, { label: string; chip: string }> = {
  confirmed: { label: "Confirmada", chip: "bg-haze text-royal-dark" },
  completed: { label: "Completada", chip: "bg-ink/5 text-ink-soft" },
  cancelled: { label: "Cancelada", chip: "bg-danger-soft text-danger line-through" },
};

const keyOf = (d: Ymd) => `${d.year}-${d.month}-${d.day}`;
const sameDay = (a: Ymd, b: Ymd) => keyOf(a) === keyOf(b);
const dateParam = (d: Ymd) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
// Fecha de calendario como Date a mediodía UTC, para formatear sin saltos de zona
const asDate = (d: Ymd) => new Date(Date.UTC(d.year, d.month - 1, d.day, 12));

type Props = {
  view: "month" | "week";
  anchor: Ymd;
  today: Ymd;
  gridStart: Ymd;
  dayCount: number;
  timezone: string;
  appointments: CalendarAppointment[];
  links: { prev: string; next: string; today: string; month: string; week: string };
};

export function CalendarView({ view, anchor, today, gridStart, dayCount, timezone, appointments, links }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  const days = Array.from({ length: dayCount }, (_, i) => addDays(gridStart.year, gridStart.month, gridStart.day, i));
  const byDay = new Map<string, CalendarAppointment[]>();
  for (const a of appointments) {
    const p = zonedParts(new Date(a.starts_at), timezone);
    const key = keyOf(p);
    byDay.set(key, [...(byDay.get(key) ?? []), a]);
  }

  const time = (iso: string) =>
    formatInTz(new Date(iso), timezone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  const title =
    view === "month"
      ? formatInTz(asDate(anchor), "UTC", { month: "long", year: "numeric" })
      : `${formatInTz(asDate(days[0]), "UTC", { day: "numeric", month: "short" })} – ${formatInTz(asDate(days[6]), "UTC", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Link href={links.prev} className={buttonClass.ghost} aria-label="Anterior">
            <CaretLeft size={18} />
          </Link>
          <Link href={links.next} className={buttonClass.ghost} aria-label="Siguiente">
            <CaretRight size={18} />
          </Link>
          <Link href={links.today} className={buttonClass.secondary}>
            Hoy
          </Link>
        </div>
        <h2 className="font-display text-xl font-semibold first-letter:uppercase">{title}</h2>
        <div className="ml-auto flex rounded-lg border border-line bg-paper p-1 text-sm">
          {(
            [
              ["month", "Mes", links.month],
              ["week", "Semana", links.week],
            ] as const
          ).map(([value, label, href]) => (
            <Link
              key={value}
              href={href}
              aria-current={view === value ? "page" : undefined}
              className={`rounded-md px-3 py-1 font-medium ${view === value ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {view === "month" ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-paper">
          <div className="grid grid-cols-7 border-b border-line text-center text-xs font-medium text-ink-soft">
            {DAY_HEADERS.map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const items = byDay.get(keyOf(d)) ?? [];
              const outside = d.month !== anchor.month;
              return (
                <div
                  key={keyOf(d)}
                  className={`min-h-20 border-b border-r border-line/70 p-1.5 sm:min-h-28 [&:nth-child(7n)]:border-r-0 ${outside ? "bg-porcelain/60" : ""}`}
                >
                  <Link
                    href={`/citas?view=week&date=${dateParam(d)}`}
                    className={`grid size-7 place-items-center rounded-full text-sm ${
                      sameDay(d, today) ? "bg-royal font-semibold text-white" : outside ? "text-ink-soft/50" : "text-ink"
                    }`}
                  >
                    {d.day}
                  </Link>
                  {items.length > 0 && (
                    <span className="mt-1 block text-center text-xs font-medium text-royal sm:hidden">{items.length}</span>
                  )}
                  <ul className="mt-1 hidden space-y-1 sm:block">
                    {items.slice(0, 3).map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(a.id)}
                          className={`w-full truncate rounded px-1.5 py-0.5 text-left text-xs ${STATUS[a.status ?? "confirmed"]?.chip}`}
                        >
                          <span className="font-semibold">{time(a.starts_at)}</span> {a.full_name}
                        </button>
                      </li>
                    ))}
                    {items.length > 3 && (
                      <li>
                        <Link href={`/citas?view=week&date=${dateParam(d)}`} className="px-1.5 text-xs text-ink-soft hover:text-ink">
                          {items.length - 3} más
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-7 md:gap-2">
          {days.map((d, i) => {
            const items = byDay.get(keyOf(d)) ?? [];
            return (
              <section key={keyOf(d)} className="rounded-xl border border-line bg-paper p-2 md:min-h-64">
                <h3 className="flex items-baseline gap-2 px-1 pb-2 text-sm">
                  <span className="text-ink-soft">{DAY_HEADERS[i]}</span>
                  <span className={`font-display font-semibold ${sameDay(d, today) ? "text-royal" : "text-ink"}`}>{d.day}</span>
                </h3>
                {items.length === 0 ? (
                  <p className="px-1 text-xs text-ink-soft/70">Sin citas</p>
                ) : (
                  <ul className="space-y-1.5">
                    {items.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(a.id)}
                          className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${STATUS[a.status ?? "confirmed"]?.chip}`}
                        >
                          <span className="block font-semibold">
                            {time(a.starts_at)}–{time(a.ends_at)}
                          </span>
                          <span className="block truncate">{a.full_name}</span>
                          <span className="block truncate opacity-80">{a.service}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {selected && (
        <AppointmentModal appointment={selected} timezone={timezone} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}

function AppointmentModal({
  appointment,
  timezone,
  onClose,
}: {
  appointment: CalendarAppointment;
  timezone: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; warning?: string } | null>(null);
  const status = appointment.status ?? "confirmed";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function change(next: "cancelled" | "completed") {
    if (next === "cancelled" && !window.confirm("¿Cancelar esta cita? También se borrará de Google Calendar.")) return;
    startTransition(async () => setFeedback(await updateAppointmentStatus(appointment.id, next)));
  }

  const when = formatInTz(new Date(appointment.starts_at), timezone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const end = formatInTz(new Date(appointment.ends_at), timezone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="appointment-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-paper p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="appointment-title" className="text-xl font-semibold">{appointment.full_name}</h2>
            <p className="mt-1 text-sm text-ink-soft first-letter:uppercase">
              {when} – {end}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-ink-soft hover:bg-ink/5 hover:text-ink">
            <X size={20} />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-ink-soft">Servicio</dt>
          <dd className="font-medium">{appointment.service}</dd>
          <dt className="text-ink-soft">Estado</dt>
          <dd>
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS[status]?.chip}`}>{STATUS[status]?.label}</span>
          </dd>
          <dt className="text-ink-soft">Teléfono</dt>
          <dd className="flex flex-wrap items-center gap-3">
            <a href={`tel:${appointment.phone}`} className="inline-flex items-center gap-1 text-royal hover:underline">
              <Phone size={14} />
              {appointment.phone}
            </a>
            <a
              href={`https://wa.me/${appointment.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-royal hover:underline"
            >
              <WhatsappLogo size={14} />
              WhatsApp
            </a>
          </dd>
          <dt className="text-ink-soft">Cliente nuevo</dt>
          <dd>{appointment.is_new_patient === null ? "Sin dato" : appointment.is_new_patient ? "Sí" : "No"}</dd>
          <dt className="text-ink-soft">Notas</dt>
          <dd className="whitespace-pre-wrap">{appointment.notes || "—"}</dd>
        </dl>

        {feedback?.error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{feedback.error}</p>}
        {feedback?.warning && <p role="status" className="mt-4 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">{feedback.warning}</p>}

        {status === "confirmed" && (
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" disabled={pending} onClick={() => change("completed")} className={buttonClass.primary}>
              <CheckCircle size={18} />
              Marcar como completada
            </button>
            <button type="button" disabled={pending} onClick={() => change("cancelled")} className={buttonClass.danger}>
              <XCircle size={18} />
              Cancelar cita
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
