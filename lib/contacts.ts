import type { Json } from "@/lib/database.types";

type ContactLike = { full_name: string | null; wa_phone: string; metadata?: Json | null } | null | undefined;

// Nombre guardado por el negocio/agente > nombre de perfil de WhatsApp (el "~") > teléfono
export function contactName(contact: ContactLike): string {
  const metadata = contact?.metadata;
  const profileName =
    metadata && typeof metadata === "object" && !Array.isArray(metadata) && typeof metadata.wa_profile_name === "string"
      ? metadata.wa_profile_name.trim()
      : "";
  return contact?.full_name || profileName || contact?.wa_phone || "Contacto";
}

const AVATAR_COLORS = [
  "bg-ink/90 text-haze",
  "bg-royal text-white",
  "bg-aqua text-ink",
  "bg-periwinkle text-ink",
  "bg-orchid text-ink",
  "bg-amber-soft text-amber",
  "bg-emerald-200 text-emerald-900",
  "bg-rose-200 text-rose-900",
];

// Color estable por contacto (mismo teléfono → mismo color)
export function avatarColor(key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
