-- Seed mínimo para desarrollo local (`supabase db reset`).
-- Usuario demo: demo@example.com / demo1234. El trigger on_auth_user_created crea su organización.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', 'demo@example.com',
  extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"business_name": "Clínica Dental Demo", "full_name": "Dueña Demo"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '{"sub": "11111111-1111-1111-1111-111111111111", "email": "demo@example.com"}',
  'email', now(), now(), now()
);

do $$
declare
  v_org uuid;
  v_ana uuid;
  v_luis uuid;
  v_conv_ana uuid;
  v_conv_luis uuid;
begin
  select organization_id into v_org from public.profiles where id = '11111111-1111-1111-1111-111111111111';

  insert into public.contacts (organization_id, wa_phone, full_name, is_new_patient)
  values (v_org, '+5215511111111', 'Ana López', false) returning id into v_ana;
  insert into public.contacts (organization_id, wa_phone, full_name, is_new_patient)
  values (v_org, '+5215522222222', null, null) returning id into v_luis;

  insert into public.conversations (organization_id, contact_id, bot_active, last_message_at)
  values (v_org, v_ana, true, now() - interval '2 hours') returning id into v_conv_ana;
  insert into public.conversations (organization_id, contact_id, bot_active, last_message_at)
  values (v_org, v_luis, false, now() - interval '1 day') returning id into v_conv_luis;

  insert into public.messages (conversation_id, organization_id, wa_message_id, direction, sender, content, created_at) values
    (v_conv_ana, v_org, 'seed.1', 'inbound', 'contact', 'Hola, quiero agendar una limpieza', now() - interval '2 hours 5 minutes'),
    (v_conv_ana, v_org, 'seed.2', 'outbound', 'bot', '¡Hola Ana! Claro. Tengo estos horarios: martes 10:00, miércoles 12:30 o jueves 16:00. ¿Cuál te acomoda?', now() - interval '2 hours 4 minutes'),
    (v_conv_ana, v_org, 'seed.3', 'inbound', 'contact', 'El martes a las 10', now() - interval '2 hours'),
    (v_conv_luis, v_org, 'seed.4', 'inbound', 'contact', '¿Aceptan seguro dental?', now() - interval '1 day 1 minute'),
    (v_conv_luis, v_org, 'seed.5', 'outbound', 'bot', 'Te paso con un humano en un momento.', now() - interval '1 day');

  insert into public.appointments (organization_id, contact_id, service, starts_at, ends_at, status, is_new_patient, full_name, phone)
  values
    (v_org, v_ana, 'Limpieza', date_trunc('day', now()) + interval '2 days 16 hours', date_trunc('day', now()) + interval '2 days 16 hours 45 minutes', 'confirmed', false, 'Ana López', '+5215511111111'),
    (v_org, v_ana, 'Empaste', date_trunc('day', now()) - interval '5 days' + interval '17 hours', date_trunc('day', now()) - interval '5 days' + interval '18 hours', 'completed', false, 'Ana López', '+5215511111111');
end;
$$;
