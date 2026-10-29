import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/crypto";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
export const GOOGLE_STATE_COOKIE = "google_oauth_state";

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI!,
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    // fuerza que Google devuelva refresh_token aunque el usuario ya haya dado consentimiento
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok) throw new Error(`Google OAuth: ${json.error_description ?? json.error ?? res.status}`);
  return json;
}

export function exchangeCode(code: string) {
  return tokenRequest({
    code,
    grant_type: "authorization_code",
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI!,
  });
}

// Access token vigente + calendar_id de la organización, o null si no conectó Google Calendar.
export async function getCalendarAccess(
  organizationId: string,
): Promise<{ accessToken: string; calendarId: string } | null> {
  const supabase = createAdminClient();
  const { data: config, error } = await supabase
    .from("google_calendar_configs")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  if (!config) return null;

  const expiresAt = config.token_expires_at ? new Date(config.token_expires_at).getTime() : 0;
  if (config.access_token_encrypted && expiresAt - Date.now() > 60_000) {
    return { accessToken: decrypt(config.access_token_encrypted), calendarId: config.calendar_id };
  }

  const refreshed = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: decrypt(config.refresh_token_encrypted),
  });
  await supabase
    .from("google_calendar_configs")
    .update({
      access_token_encrypted: encrypt(refreshed.access_token),
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    })
    .eq("organization_id", organizationId);

  return { accessToken: refreshed.access_token, calendarId: config.calendar_id };
}
