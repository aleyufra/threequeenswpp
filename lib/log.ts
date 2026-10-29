// Logs estructurados en JSON (una línea por evento) para Vercel / cualquier colector.

type Level = "info" | "warn" | "error";

export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  // PostgrestError y similares son objetos planos con `message`
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    const code = "code" in err && err.code ? ` (${String(err.code)})` : "";
    return `${err.message}${code}`;
  }
  return String(err);
}
