"use client";

import { useActionState, useState } from "react";
import { ArrowCounterClockwise, Plus, Trash } from "@phosphor-icons/react";
import { DEFAULT_SYSTEM_PROMPT, TONE_PRESETS } from "@/lib/agent/default-template";
import { WEEKDAY_LABELS, type Weekday } from "@/lib/time";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { buttonClass, hintClass, inputClass, labelClass, sectionClass } from "@/components/ui";
import { saveAgentConfig, type AgentConfigPayload } from "./actions";

const DAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const COMMON_TIMEZONES = [
  "America/Mexico_City",
  "America/Monterrey",
  "America/Tijuana",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Caracas",
  "America/New_York",
  "Europe/Madrid",
];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className={`${sectionClass} mt-6`}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function AgentForm({ initial }: { initial: AgentConfigPayload }) {
  const [state, action] = useActionState(saveAgentConfig, null);
  const [form, setForm] = useState(initial);

  const set = <K extends keyof AgentConfigPayload>(key: K, value: AgentConfigPayload[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setInfo = (key: Exclude<keyof AgentConfigPayload["business_info"], "phones">, value: string) =>
    set("business_info", { ...form.business_info, [key]: value });
  const setPhones = (phones: string[]) => set("business_info", { ...form.business_info, phones });
  const phones = form.business_info.phones.length ? form.business_info.phones : [""];
  const setRanges = (day: Weekday, ranges: AgentConfigPayload["business_hours"][Weekday]) =>
    set("business_hours", { ...form.business_hours, [day]: ranges });

  return (
    <form action={action} className="pb-24">
      <input type="hidden" name="payload" value={JSON.stringify(form)} />

      <Section title="Instrucciones del asistente" description="Quién es, qué debe hacer y qué no. Las reglas para agendar citas ya están incluidas.">
        <textarea
          id="system_prompt"
          aria-label="Instrucciones del asistente"
          value={form.system_prompt}
          onChange={(e) => set("system_prompt", e.target.value)}
          rows={12}
          className={`${inputClass} font-mono text-[15px] leading-relaxed`}
        />
        <button type="button" onClick={() => set("system_prompt", DEFAULT_SYSTEM_PROMPT)} className={`${buttonClass.ghost} mt-2 -ml-3`}>
          <ArrowCounterClockwise size={16} />
          Restaurar plantilla de clínica dental
        </button>
      </Section>

      <Section title="Tono de voz">
        <div className="flex flex-wrap gap-2">
          {TONE_PRESETS.map((tone) => (
            <button
              key={tone}
              type="button"
              aria-pressed={form.tone === tone}
              onClick={() => set("tone", tone)}
              className={`rounded-md border px-3 py-1 text-sm ${
                form.tone === tone ? "border-royal bg-haze text-royal-dark" : "border-line text-ink-soft hover:text-ink"
              }`}
            >
              {tone}
            </button>
          ))}
        </div>
        <label htmlFor="tone" className={`${labelClass} mt-4`}>O descríbelo con tus palabras</label>
        <input id="tone" value={form.tone} onChange={(e) => set("tone", e.target.value)} className={inputClass} />
      </Section>

      <Section title="Información del negocio" description="El asistente la usa para responder preguntas.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="info-name" className={labelClass}>Nombre</label>
            <input id="info-name" value={form.business_info.name} onChange={(e) => setInfo("name", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="info-phone-0" className={labelClass}>Teléfonos</label>
            <div className="flex flex-col gap-2">
              {phones.map((phone, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    id={`info-phone-${i}`}
                    aria-label={`Teléfono ${i + 1}`}
                    value={phone}
                    onChange={(e) => setPhones(phones.map((p, j) => (j === i ? e.target.value : p)))}
                    className={inputClass}
                  />
                  {phones.length > 1 && (
                    <button type="button" onClick={() => setPhones(phones.filter((_, j) => j !== i))} className={buttonClass.ghost}>
                      <Trash size={16} />
                      <span className="sr-only">Quitar teléfono</span>
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setPhones([...phones, ""])}
                className="self-start text-sm font-medium text-royal hover:underline"
              >
                Agregar otro teléfono
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="info-address" className={labelClass}>Dirección</label>
            <input id="info-address" value={form.business_info.address} onChange={(e) => setInfo("address", e.target.value)} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="info-cancel" className={labelClass}>Política de cancelación</label>
            <textarea
              id="info-cancel"
              rows={2}
              value={form.business_info.cancellation_policy}
              onChange={(e) => setInfo("cancellation_policy", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="info-faq" className={labelClass}>Preguntas frecuentes, productos y precios</label>
            <textarea
              id="info-faq"
              rows={6}
              value={form.business_info.faq}
              onChange={(e) => setInfo("faq", e.target.value)}
              placeholder={"¿Aceptan seguro? Sí, trabajamos con…\n¿Tienen estacionamiento? …"}
              className={inputClass}
            />
            <p className={hintClass}>Texto libre. Incluye lo que tus clientes suelen preguntar.</p>
          </div>
        </div>
      </Section>

      <Section title="Servicios" description="Lo que el asistente puede agendar. La duración define el tamaño de cada hueco.">
        <ul className="space-y-3">
          {form.services.map((service, i) => (
            <li key={i} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_7rem_auto] sm:items-start">
              <input
                aria-label="Nombre del servicio"
                value={service.name}
                placeholder="Nombre"
                onChange={(e) => set("services", form.services.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)))}
                className={inputClass}
              />
              <div className="flex items-center gap-2">
                <input
                  aria-label="Duración en minutos"
                  type="number"
                  min={5}
                  max={600}
                  step={5}
                  value={service.duration_minutes}
                  onChange={(e) =>
                    set("services", form.services.map((s, j) => (j === i ? { ...s, duration_minutes: Number(e.target.value) } : s)))
                  }
                  className={inputClass}
                />
                <span className="text-sm text-ink-soft">min</span>
              </div>
              <button
                type="button"
                onClick={() => set("services", form.services.filter((_, j) => j !== i))}
                className={`${buttonClass.ghost} justify-self-start`}
              >
                <Trash size={16} />
                <span className="sm:sr-only">Quitar</span>
              </button>
              <input
                aria-label="Descripción del servicio"
                value={service.description}
                placeholder="Descripción breve (opcional)"
                onChange={(e) => set("services", form.services.map((s, j) => (j === i ? { ...s, description: e.target.value } : s)))}
                className={`${inputClass} sm:col-span-3`}
              />
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => set("services", [...form.services, { name: "", duration_minutes: 30, description: "" }])}
          className={`${buttonClass.secondary} mt-3`}
        >
          <Plus size={16} />
          Agregar servicio
        </button>
      </Section>

      <Section title="Horario de atención" description="El asistente sólo ofrece citas dentro de estos rangos.">
        <ul className="divide-y divide-line">
          {DAYS.map((day) => {
            const ranges = form.business_hours[day];
            const open = ranges.length > 0;
            return (
              <li key={day} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
                <label className="flex w-36 shrink-0 items-center gap-2 pt-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={open}
                    onChange={(e) => setRanges(day, e.target.checked ? [{ start: "09:00", end: "18:00" }] : [])}
                    className="size-4 accent-royal"
                  />
                  {WEEKDAY_LABELS[day]}
                </label>
                {open ? (
                  <div className="flex flex-1 flex-col gap-2">
                    {ranges.map((range, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="time"
                          aria-label={`${WEEKDAY_LABELS[day]}: desde`}
                          value={range.start}
                          onChange={(e) => setRanges(day, ranges.map((r, j) => (j === i ? { ...r, start: e.target.value } : r)))}
                          className={`${inputClass} w-32`}
                        />
                        <span className="text-sm text-ink-soft">a</span>
                        <input
                          type="time"
                          aria-label={`${WEEKDAY_LABELS[day]}: hasta`}
                          value={range.end}
                          onChange={(e) => setRanges(day, ranges.map((r, j) => (j === i ? { ...r, end: e.target.value } : r)))}
                          className={`${inputClass} w-32`}
                        />
                        <button
                          type="button"
                          onClick={() => setRanges(day, ranges.filter((_, j) => j !== i))}
                          className={buttonClass.ghost}
                        >
                          <Trash size={16} />
                          <span className="sr-only">Quitar rango</span>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setRanges(day, [...ranges, { start: "15:00", end: "19:00" }])}
                      className="self-start text-sm font-medium text-royal hover:underline"
                    >
                      Agregar otro rango
                    </button>
                  </div>
                ) : (
                  <p className="pt-2 text-sm text-ink-soft">Cerrado</p>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-4 max-w-sm">
          <label htmlFor="timezone" className={labelClass}>Zona horaria</label>
          <input
            id="timezone"
            list="timezones"
            value={form.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className={inputClass}
          />
          <datalist id="timezones">
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
        </div>
      </Section>

      <Section title="Datos de la cita y traspaso a una persona">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.ask_new_patient}
            onChange={(e) => set("ask_new_patient", e.target.checked)}
            className="mt-0.5 size-4 accent-royal"
          />
          <span>
            <span className="font-medium">Preguntar si es cliente nuevo</span>
            <span className={`${hintClass} block`}>Desactívalo si a tu negocio no le sirve ese dato.</span>
          </span>
        </label>
        <label htmlFor="handoff_message" className={`${labelClass} mt-5`}>Mensaje al pasar con una persona</label>
        <input
          id="handoff_message"
          value={form.handoff_message}
          onChange={(e) => set("handoff_message", e.target.value)}
          className={inputClass}
        />
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:px-6 md:left-60 lg:px-10">
        {/* mismo padding que <main> para alinear con el contenido */}
        <div className="flex max-w-4xl flex-wrap items-center gap-3">
          <SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton>
          <div className="min-w-0 flex-1">
            <FormMessage state={state} />
          </div>
        </div>
      </div>
    </form>
  );
}
