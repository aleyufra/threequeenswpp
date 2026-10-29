-- =============================================================================
-- Esquema inicial: plataforma multi-tenant de atención por WhatsApp
-- =============================================================================

create schema if not exists private;

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------

-- organizations: cuenta del negocio (clínica dental, otro negocio, etc.)
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  timezone text not null default 'America/Mexico_City',
  created_at timestamptz default now()
);

-- profiles: extiende auth.users, vincula a organization
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  full_name text,
  role text check (role in ('owner', 'staff')) default 'owner',
  created_at timestamptz default now()
);

-- whatsapp_configs: credenciales por organización (secretos cifrados con AES-256-GCM en la app)
create table public.whatsapp_configs (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  phone_number_id text not null unique,
  waba_id text not null,
  access_token_encrypted text not null,
  verify_token text not null unique,
  app_secret_encrypted text not null,
  updated_at timestamptz default now()
);

-- google_calendar_configs: tokens OAuth por organización
create table public.google_calendar_configs (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  calendar_id text not null,
  refresh_token_encrypted text not null,
  access_token_encrypted text,
  token_expires_at timestamptz,
  updated_at timestamptz default now()
);

-- agent_configs: personalización del prompt y datos del negocio
create table public.agent_configs (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  system_prompt text not null,
  tone text not null default 'profesional y cálido',
  business_info jsonb not null default '{}'::jsonb,
  services jsonb not null default '[]'::jsonb,
  business_hours jsonb not null default '{}'::jsonb,
  handoff_message text default 'Te paso con un humano en un momento.',
  -- si es false, el agente no pregunta "¿es nuevo cliente?" (negocios que no lo necesitan)
  ask_new_patient boolean not null default true,
  updated_at timestamptz default now()
);

-- contacts: clientes que han escrito por WhatsApp
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  wa_phone text not null,
  full_name text,
  is_new_patient boolean,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (organization_id, wa_phone)
);

-- conversations: un hilo por contacto
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  bot_active boolean default true,
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (organization_id, contact_id)
);

-- messages: cada mensaje entrante o saliente
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  wa_message_id text,
  direction text check (direction in ('inbound', 'outbound')) not null,
  sender text check (sender in ('contact', 'bot', 'human')) not null,
  content text,
  raw jsonb,
  created_at timestamptz default now(),
  unique (wa_message_id)
);

-- appointments: citas agendadas
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  service text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  google_event_id text,
  status text check (status in ('confirmed', 'cancelled', 'completed')) default 'confirmed',
  is_new_patient boolean,
  full_name text not null,
  phone text not null,
  notes text,
  created_at timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------

create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index messages_org_created_idx on public.messages (organization_id, created_at);
create index conversations_org_last_message_idx on public.conversations (organization_id, last_message_at desc);
create index conversations_contact_idx on public.conversations (contact_id);
create index appointments_org_starts_idx on public.appointments (organization_id, starts_at);
create index appointments_contact_idx on public.appointments (contact_id);
create index profiles_org_idx on public.profiles (organization_id);

-- Idempotencia de book_appointment: una cita activa por contacto y horario
create unique index appointments_active_slot_uidx
  on public.appointments (organization_id, contact_id, starts_at)
  where status <> 'cancelled';

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger whatsapp_configs_updated_at before update on public.whatsapp_configs
  for each row execute function private.set_updated_at();
create trigger google_calendar_configs_updated_at before update on public.google_calendar_configs
  for each row execute function private.set_updated_at();
create trigger agent_configs_updated_at before update on public.agent_configs
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

-- Organización del usuario autenticado. security definer para leer profiles sin
-- recursión de RLS; vive en `private` (no expuesto por la Data API).
create or replace function private.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id from public.profiles where id = (select auth.uid());
$$;

revoke all on function private.current_org_id() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.current_org_id() to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.whatsapp_configs enable row level security;
alter table public.google_calendar_configs enable row level security;
alter table public.agent_configs enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.appointments enable row level security;

-- organizations
create policy "org members read their organization" on public.organizations
  for select to authenticated
  using (id = (select private.current_org_id()));
create policy "org members update their organization" on public.organizations
  for update to authenticated
  using (id = (select private.current_org_id()))
  with check (id = (select private.current_org_id()));

-- profiles
create policy "read own org profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or organization_id = (select private.current_org_id()));
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Tablas con organization_id: acceso total dentro de la propia organización
do $$
declare
  t text;
begin
  foreach t in array array[
    'whatsapp_configs', 'google_calendar_configs', 'agent_configs',
    'contacts', 'conversations', 'messages', 'appointments'
  ]
  loop
    execute format(
      'create policy "org select" on public.%I for select to authenticated
         using (organization_id = (select private.current_org_id()))', t);
    execute format(
      'create policy "org insert" on public.%I for insert to authenticated
         with check (organization_id = (select private.current_org_id()))', t);
    execute format(
      'create policy "org update" on public.%I for update to authenticated
         using (organization_id = (select private.current_org_id()))
         with check (organization_id = (select private.current_org_id()))', t);
    execute format(
      'create policy "org delete" on public.%I for delete to authenticated
         using (organization_id = (select private.current_org_id()))', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants (explícitos: la Data API puede no exponer tablas nuevas por defecto)
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

grant select, insert, update, delete on
  public.whatsapp_configs, public.google_calendar_configs, public.agent_configs,
  public.contacts, public.conversations, public.messages, public.appointments
  to authenticated;
grant select on public.organizations, public.profiles to authenticated;
-- el usuario no puede cambiar su organization_id ni su rol
grant update (name, timezone) on public.organizations to authenticated;
grant update (full_name) on public.profiles to authenticated;

grant all on all tables in schema public to service_role;

-- -----------------------------------------------------------------------------
-- Signup: crea organization + profile + agent_config por defecto
-- -----------------------------------------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_name text;
  v_slug text;
begin
  -- raw_user_meta_data es editable por el usuario: sólo se usa como nombre inicial, nunca para autorizar
  v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''), 'Mi negocio');
  v_slug := trim(both '-' from lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g')));
  v_slug := coalesce(nullif(v_slug, ''), 'org') || '-' || substr(md5(gen_random_uuid()::text), 1, 6);

  insert into public.organizations (name, slug)
  values (v_name, v_slug)
  returning id into v_org_id;

  insert into public.profiles (id, organization_id, full_name, role)
  values (new.id, v_org_id, new.raw_user_meta_data ->> 'full_name', 'owner');

  -- Mantener sincronizado con lib/agent/default-template.ts
  insert into public.agent_configs (organization_id, system_prompt, business_info, services, business_hours)
  values (
    v_org_id,
    'Eres el asistente virtual de una clínica dental y atiendes a los clientes por WhatsApp.
Tu objetivo es resolver dudas sobre la clínica y agendar citas.

- Escribe mensajes breves (2 a 4 líneas), claros y aptos para WhatsApp.
- Si el cliente quiere una cita, pregunta qué servicio necesita, ofrécele horarios disponibles y recoge sus datos.
- No des diagnósticos ni indicaciones médicas. Si describe dolor intenso o una urgencia, recomiéndale acudir de inmediato y ofrece pasarle con una persona del equipo.
- Si no sabes algo, no lo inventes: ofrece pasarle con una persona del equipo.',
    jsonb_build_object(
      'name', v_name,
      'address', '',
      'phone', '',
      'cancellation_policy', 'Puedes cancelar o reprogramar con al menos 24 horas de anticipación.',
      'faq', ''
    ),
    '[
      {"name": "Limpieza", "duration_minutes": 45, "description": "Limpieza dental profesional"},
      {"name": "Empaste", "duration_minutes": 60, "description": "Tratamiento de caries con resina"},
      {"name": "Blanqueamiento", "duration_minutes": 90, "description": "Blanqueamiento dental en consultorio"}
    ]'::jsonb,
    '{
      "mon": [{"start": "09:00", "end": "18:00"}],
      "tue": [{"start": "09:00", "end": "18:00"}],
      "wed": [{"start": "09:00", "end": "18:00"}],
      "thu": [{"start": "09:00", "end": "18:00"}],
      "fri": [{"start": "09:00", "end": "18:00"}],
      "sat": [{"start": "09:00", "end": "14:00"}],
      "sun": []
    }'::jsonb
  );

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- RPC para el dashboard: conversaciones con actividad por día (respeta RLS)
-- -----------------------------------------------------------------------------

create or replace function public.conversations_per_day(n_days integer default 30)
returns table (day date, conversations bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (m.created_at at time zone o.timezone)::date as day,
    count(distinct m.conversation_id) as conversations
  from public.messages m
  join public.organizations o on o.id = m.organization_id
  where m.created_at >= now() - make_interval(days => n_days)
  group by 1
  order by 1;
$$;

revoke all on function public.conversations_per_day(integer) from public, anon;
grant execute on function public.conversations_per_day(integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime (postgres_changes respeta las políticas de select)
-- -----------------------------------------------------------------------------

alter publication supabase_realtime add table public.messages, public.conversations;
