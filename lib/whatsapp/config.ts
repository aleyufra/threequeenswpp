import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import type { Tables } from "@/lib/database.types";

export type WhatsAppCredentials = {
  organizationId: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  appSecret: string;
};

function toCredentials(row: Tables<"whatsapp_configs">): WhatsAppCredentials {
  return {
    organizationId: row.organization_id,
    phoneNumberId: row.phone_number_id,
    wabaId: row.waba_id,
    accessToken: decrypt(row.access_token_encrypted),
    appSecret: decrypt(row.app_secret_encrypted),
  };
}

export async function getWhatsAppCredentialsByPhoneNumberId(
  phoneNumberId: string,
): Promise<WhatsAppCredentials | null> {
  const { data, error } = await createAdminClient()
    .from("whatsapp_configs")
    .select("*")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  if (error) throw error;
  return data ? toCredentials(data) : null;
}

export async function getWhatsAppCredentials(organizationId: string): Promise<WhatsAppCredentials | null> {
  const { data, error } = await createAdminClient()
    .from("whatsapp_configs")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  return data ? toCredentials(data) : null;
}
