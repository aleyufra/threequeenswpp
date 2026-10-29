import Link from "next/link";
import { CalendarCheck, Checks, HandWaving, Robot } from "@phosphor-icons/react/ssr";
import { BrandIcon, BrandMark } from "@/components/brand";
import { buttonClass } from "@/components/ui";

const DEMO = [
  { from: "client", text: "¿Tienen las zapatillas blancas en talla 38?" },
  { from: "bot", text: "¡Sí! ¿Quieres pasar a probártelas el sábado a las 10:00?" },
  { from: "client", text: "Dale, perfecto" },
  { from: "bot", text: "Listo: *talla 38 apartada para el sábado a las 10:00* 👑" },
] as const;

const POINTS = [
  { icon: Robot, text: "Responde 24/7" },
  { icon: CalendarCheck, text: "Agenda en Google Calendar" },
  { icon: HandWaving, text: "Te pasa la conversación" },
];

export default function LandingPage() {
  return (
    <div className="bg-brand">
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between gap-3 py-5">
          <BrandMark />
        </header>

        <main className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <h1 className="max-w-lg font-display text-4xl leading-tight font-semibold tracking-tight text-ink sm:text-5xl">
              Tu WhatsApp atiende, agenda y te avisa.
            </h1>
            <p className="mt-4 max-w-md text-lg text-ink">
              Un asistente con IA que responde a tus clientes y llena tu agenda.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-1.5 rounded-md bg-paper/70 px-3 py-1.5 text-sm font-medium text-ink">
                  <Icon size={18} weight="duotone" className="text-royal" />
                  {text}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={`${buttonClass.primary} px-5 py-3 text-base`}>Crear cuenta</Link>
              <Link href="/login" className={`${buttonClass.secondary} px-5 py-3 text-base`}>Entrar</Link>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm rounded-3xl border border-white/60 bg-paper p-3 shadow-2xl shadow-royal/25">
            <div className="flex items-center gap-3 rounded-t-lg bg-royal px-4 py-3 text-white">
              <BrandIcon className="rounded-full" />
              <span>
                <span className="block text-sm font-semibold">Three Queens Calzados</span>
                <span className="block text-xs text-white/75">responde el asistente</span>
              </span>
            </div>
            <ol className="flex flex-col gap-2 rounded-b-lg bg-porcelain px-3 py-4" aria-label="Ejemplo de conversación">
              {DEMO.map((m, i) => (
                <li
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
                    m.from === "client" ? "self-end rounded-tr-sm bg-paper text-ink" : "self-start rounded-tl-sm bg-haze text-ink"
                  }`}
                >
                  {m.text.split("*").map((part, j) => (j % 2 ? <strong key={j}>{part}</strong> : part))}
                  {m.from === "client" && <Checks size={14} className="ml-1 inline text-royal" aria-hidden />}
                </li>
              ))}
            </ol>
          </div>
        </main>

        <footer className="py-5 text-xs text-ink-soft">
          Funciona con la API oficial de WhatsApp Business y Google Calendar.
        </footer>
      </div>
    </div>
  );
}
