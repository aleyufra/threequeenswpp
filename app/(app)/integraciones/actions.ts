"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { encrypt } from "@/lib/crypto";
import { errorMessage } from "@/lib/log";
import { GOOGLE_STATE_COOKIE, buildGoogleAuthUrl } from "@/lib/google/oauth";
import { getWhatsAppCredentials } from "@/lib/whatsapp/config";
import { fetchPhoneNumberInfo, subscribeAppToWaba } from "@/lib/whatsapp/send";
import type { FormState } from "@/components/form-message";

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

// El verify token identifica a la organización en la verificación del webhook: aleatorio y único
const newVerifyToken = () => randomBytes(24).toString("base64url");

export async function saveWhatsAppConfig(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, organizationId } = await getSession();
  const phoneNumberId = field(formData, "phone_number_id");
  const wabaId = field(formData, "waba_id");
  const accessToken = field(formData, "access_token");
  const appSecret = field(formData, "app_secret");

  if (!phoneNumberId || !wabaId) return { error: "Phone Number ID y WABA ID son obligatorios." };

  const { data: existing } = await supabase
    .from("whatsapp_configs")
    .select("access_token_encrypted, app_secret_encrypted, verify_token")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!existing && (!accessToken || !appSecret)) {
    return { error: "El access token y el App Secret son obligatorios la primera vez." };
  }

  // Los campos secretos vacíos conservan el valor guardado
  const { error } = await supabase.from("whatsapp_configs").upsert({
    organization_id: organizationId,
    phone_number_id: phoneNumberId,
    waba_id: wabaId,
    verify_token: existing?.verify_token ?? newVerifyToken(),
    access_token_encrypted: accessToken ? encrypt(accessToken) : existing!.access_token_encrypted,
    app_secret_encrypted: appSecret ? encrypt(appSecret) : existing!.app_secret_encrypted,
  });
  if (error) {
    if (error.code === "23505") return { error: "Ese Phone Number ID ya está conectado en otra cuenta." };
    return { error: error.message };
  }

  revalidatePath("/integraciones");
  try {
    const credentials = await getWhatsAppCredentials(organizationId);
    if (credentials) await subscribeAppToWaba(credentials.wabaId, credentials.accessToken);
  } catch (err) {
    return { error: `Credenciales guardadas, pero no se pudo suscribir la app a tu WABA: ${errorMessage(err)}` };
  }
  return {
    ok: true,
    message: existing
      ? "Credenciales guardadas y app suscrita a tu WABA."
      : "Credenciales guardadas y app suscrita a tu WABA. Ahora configura el webhook en Meta.",
  };
}

export async function regenerateVerifyToken(): Promise<FormState> {
  const { supabase, organizationId } = await getSession();
  // Meta deja de poder verificar con el token anterior: el webhook vuelve a quedar pendiente
  const { data, error } = await supabase
    .from("whatsapp_configs")
    .update({ verify_token: newVerifyToken(), webhook_verified_at: null })
    .eq("organization_id", organizationId)
    .select("organization_id");
  if (error) return { error: error.message };
  if (!data.length) return { error: "Primero guarda las credenciales." };

  revalidatePath("/integraciones");
  return { ok: true, message: "Nuevo verify token generado. Pégalo en Meta y pulsa «Verify and save»." };
}

export async function testWhatsAppConnection(): Promise<FormState> {
  const { organizationId } = await getSession();
  try {
    const credentials = await getWhatsAppCredentials(organizationId);
    if (!credentials) return { error: "Primero guarda las credenciales." };
    const info = await fetchPhoneNumberInfo(credentials.phoneNumberId, credentials.accessToken);
    await subscribeAppToWaba(credentials.wabaId, credentials.accessToken);
    return {
      ok: true,
      message: `Conexión correcta: ${info.verified_name ?? "número"} (${info.display_phone_number ?? credentials.phoneNumberId}). App suscrita a tu WABA.`,
    };
  } catch (err) {
    return { error: `No se pudo comprobar la conexión: ${errorMessage(err)}` };
  }
}

export async function connectGoogle() {
  await getSession();
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  redirect(buildGoogleAuthUrl(state));
}

export async function saveCalendarId(formData: FormData) {
  const { supabase, organizationId } = await getSession();
  const calendarId = field(formData, "calendar_id");
  if (!calendarId) return;
  await supabase.from("google_calendar_configs").update({ calendar_id: calendarId }).eq("organization_id", organizationId);
  revalidatePath("/integraciones");
}

export async function disconnectGoogle() {
  const { supabase, organizationId } = await getSession();
  await supabase.from("google_calendar_configs").delete().eq("organization_id", organizationId);
  revalidatePath("/integraciones");
}
