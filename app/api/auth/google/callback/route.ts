import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { encrypt } from "@/lib/crypto";
import { log, errorMessage } from "@/lib/log";
import { GOOGLE_STATE_COOKIE, exchangeCode } from "@/lib/google/oauth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const back = (status: string) => NextResponse.redirect(new URL(`/integraciones?google=${status}`, request.url));

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GOOGLE_STATE_COOKIE)?.value;
  cookieStore.delete(GOOGLE_STATE_COOKIE);

  if (params.get("error")) return back("cancelado");
  const code = params.get("code");
  if (!code || !expectedState || params.get("state") !== expectedState) return back("estado_invalido");

  const { supabase, organizationId } = await getSession();
  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) return back("sin_refresh_token");

    const { data: existing } = await supabase
      .from("google_calendar_configs")
      .select("calendar_id")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const { error } = await supabase.from("google_calendar_configs").upsert({
      organization_id: organizationId,
      calendar_id: existing?.calendar_id ?? "primary",
      refresh_token_encrypted: encrypt(tokens.refresh_token),
      access_token_encrypted: encrypt(tokens.access_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    });
    if (error) throw error;
    return back("conectado");
  } catch (err) {
    log("error", "google.oauth_callback_failed", { organization_id: organizationId, error: errorMessage(err) });
    return back("error");
  }
}
