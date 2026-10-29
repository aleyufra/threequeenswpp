import Link from "next/link";
import { contactName } from "@/lib/contacts";
import { getSession } from "@/lib/session";
import { addDays, formatInTz, weekRange, zonedParts } from "@/lib/time";
import { pageTitleClass, sectionClass } from "@/components/ui";
import { DailyChart, type DailyPoint } from "./daily-chart";

const DAYS = 30;
const pad = (n: number) => String(n).padStart(2, "0");

export default async function DashboardPage() {
  const { supabase, organizationId, org } = await getSession();
  const tz = org.timezone;
  const now = new Date();
  const since = new Date(now.getTime() - DAYS * 86_400_000).toISOString();
  const week = weekRange(now, tz);

  const [conversations, appointments, perDay, recent] = await Promise.all([
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("last_message_at", since),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .neq("status", "cancelled")
      .gte("starts_at", week.start.toISOString())
      .lt("starts_at", week.end.toISOString()),
    supabase.rpc("conversations_per_day", { n_days: DAYS }),
    supabase
      .from("conversations")
      .select("id, bot_active, last_message_at, contacts(full_name, wa_phone, metadata), messages(content, created_at)")
      .eq("organization_id", organizationId)
      .order("last_message_at", { ascending: false })
      .order("created_at", { referencedTable: "messages", ascending: false })
      .limit(1, { referencedTable: "messages" })
      .limit(5),
  ]);

  // Serie completa de 30 días en la zona horaria del negocio (los días sin actividad valen 0)
  const counts = new Map((perDay.data ?? []).map((d) => [d.day, Number(d.conversations)]));
  const today = zonedParts(now, tz);
  const points: DailyPoint[] = Array.from({ length: DAYS }, (_, i) => {
    const d = addDays(today.year, today.month, today.day, i - (DAYS - 1));
    const key = `${d.year}-${pad(d.month)}-${pad(d.day)}`;
    const date = new Date(Date.UTC(d.year, d.month - 1, d.day, 12));
    return {
      key,
      value: counts.get(key) ?? 0,
      label: formatInTz(date, "UTC", { weekday: "long", day: "numeric", month: "long" }),
      shortLabel: formatInTz(date, "UTC", { day: "numeric", month: "short" }),
    };
  });

  const weekLabel = `${formatInTz(week.start, tz, { day: "numeric", month: "short" })} – ${formatInTz(
    new Date(week.end.getTime() - 1),
    tz,
    { day: "numeric", month: "short" },
  )}`;

  return (
    <div className="max-w-5xl">
      <h1 className={pageTitleClass}>Resumen</h1>
      <p className="mt-2 text-sm text-ink-soft">{org.name}</p>

      <dl className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
        <div className="flex flex-col-reverse bg-paper p-6">
          <dt className="mt-2 text-sm text-ink-soft">clientes escribieron en los últimos 30 días</dt>
          <dd className="font-display text-5xl font-semibold tracking-tight">{conversations.count ?? 0}</dd>
        </div>
        <div className="flex flex-col-reverse bg-paper p-6">
          <dt className="mt-2 text-sm text-ink-soft">citas agendadas esta semana ({weekLabel})</dt>
          <dd className="font-display text-5xl font-semibold tracking-tight">{appointments.count ?? 0}</dd>
        </div>
      </dl>

      <section className={`${sectionClass} mt-6`}>
        <h2 className="text-lg font-semibold">Conversaciones con actividad por día</h2>
        <p className="mb-6 text-sm text-ink-soft">Últimos 30 días</p>
        <DailyChart points={points} />
      </section>

      <section className={`${sectionClass} mt-6`}>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">Últimas conversaciones</h2>
          <Link href="/conversaciones" className="text-sm font-medium text-royal hover:underline">
            Ver todas
          </Link>
        </div>
        {(recent.data ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">
            Aún no hay conversaciones. Conecta tu número en{" "}
            <Link href="/integraciones" className="font-medium text-royal hover:underline">Integraciones</Link>{" "}
            y escríbele desde tu teléfono para probarlo.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {(recent.data ?? []).map((c) => (
              <li key={c.id}>
                <Link href={`/conversaciones/${c.id}`} className="flex items-center gap-4 py-3 hover:bg-porcelain sm:-mx-2 sm:px-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {contactName(c.contacts)}
                    </span>
                    <span className="block truncate text-sm text-ink-soft">{c.messages[0]?.content ?? ""}</span>
                  </span>
                  {c.bot_active === false && (
                    <span className="shrink-0 rounded-md bg-amber-soft px-2 py-0.5 text-xs font-medium text-amber">Bot pausado</span>
                  )}
                  <span className="shrink-0 text-xs text-ink-soft">
                    {c.last_message_at &&
                      formatInTz(new Date(c.last_message_at), tz, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
