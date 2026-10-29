import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Usuario + organización de la request actual. Redirige a /login si no hay sesión.
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, full_name, role")
    .eq("id", userId)
    .single();
  if (!profile?.organization_id) redirect("/login?error=sin_organizacion");

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, timezone")
    .eq("id", profile.organization_id)
    .single();
  if (!org) redirect("/login?error=sin_organizacion");

  return { supabase, userId, profile, org, organizationId: org.id };
});

// Sólo rutas internas como destino de redirección
export function safeNextPath(next: FormDataEntryValue | string | null | undefined): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}
