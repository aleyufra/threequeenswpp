-- Estado del webhook de Meta por organización (lo escribe el endpoint con la service role)
alter table public.whatsapp_configs
  add column webhook_verified_at timestamptz,
  add column last_event_at timestamptz;
