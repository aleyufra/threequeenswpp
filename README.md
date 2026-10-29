# Three Queens — asistente de WhatsApp con IA

Plataforma SaaS multi-tenant: un agente de IA atiende a los clientes de un negocio por WhatsApp, responde preguntas, ofrece horarios libres reales, agenda citas en Google Calendar y pasa la conversación a una persona cuando hace falta. El dueño gestiona todo desde un panel web.

Viene con una plantilla de clínica dental (limpieza, empaste, blanqueamiento), pero servicios, horarios, prompt y datos del negocio se editan desde el panel, así que sirve para cualquier negocio que venda productos o agende citas.

## Arquitectura

```
[Cliente WhatsApp] ──> [Meta Cloud API] ──webhook──> [Next.js /api/webhooks/whatsapp]  (runtime Node)
                                                          │
                                                          ├─> Verifica firma X-Hub-Signature-256 (HMAC-SHA256, App Secret de la org)
                                                          ├─> Responde 200 y sigue en after()
                                                          ├─> Persiste contacto / conversación / mensaje (idempotente por wa_message_id)
                                                          ├─> Si bot_active:
                                                          │     └─> Agente (AI SDK 6 + claude-haiku-5-5, stopWhen: stepCountIs(8))
                                                          │           ├─ get_available_slots   (horario + FreeBusy de Google + citas en BD)
                                                          │           ├─ book_appointment      (evento en Google Calendar + fila en appointments)
                                                          │           ├─ save_contact_info     (actualiza contacts)
                                                          │           └─ request_human_handoff (bot_active=false + mensaje + aviso Realtime)
                                                          └─> Envía la respuesta por Graph API v25.0 y la registra como outbound

[Dueño del negocio] ──> [Panel Next.js 16] ──> [Supabase Auth + Postgres (RLS) + Realtime]
                          /dashboard  /conversaciones  /citas  /personalizacion  /integraciones
```

Multi-tenant desde el día uno: cada usuario pertenece a una `organization` y todas las tablas llevan `organization_id`, con RLS. El webhook no tiene sesión: usa la service role en el servidor y filtra siempre por la organización que resuelve a partir del `phone_number_id` del payload.

### Stack

| Pieza                | Elección                                                                      |
| -------------------- | ----------------------------------------------------------------------------- |
| Framework            | Next.js 16.2.6 (App Router, TypeScript strict, Turbopack)                     |
| Estilos / iconos     | Tailwind CSS v4, Phosphor Icons                                               |
| BD + Auth + Realtime | Supabase (`@supabase/ssr`, RLS en todas las tablas)                           |
| IA                   | Vercel AI SDK 6 (`ai@6`, `@ai-sdk/anthropic@3`), modelo `claude-haiku-5-5`    |
| WhatsApp             | WhatsApp Cloud API oficial, Graph API `v25.0` (constante `GRAPH_API_VERSION`) |
| Calendario           | Google Calendar API v3 vía OAuth 2.0                                          |
| Deploy               | Vercel (Fluid Compute, runtime Node.js en webhooks)                           |

### Decisiones técnicas

- **`proxy.ts` en lugar de `middleware.ts`**: Next 16 renombró la convención (`middleware` quedó obsoleto). Hace lo mismo: refresca la sesión de Supabase y redirige a `/login` las rutas del panel.
- **Sin `googleapis`**: el SDK pesa mucho y sólo necesitamos 5 endpoints, así que `lib/google/` usa `fetch` directo contra OAuth2 y Calendar REST.
- **Calendario de `/citas` propio**: grilla con Tailwind (vista mensual y semanal) en vez de `react-big-calendar`. Pesa menos, encaja con el diseño y no hace falta la vista por horas.
- **Sin librería de fechas**: `lib/time.ts` convierte entre la zona horaria del negocio y UTC con `Intl`, incluidos los cambios de horario.
- **Tipos de la BD**: `lib/database.types.ts` sigue el formato exacto de `supabase gen types`. Regenéralo contra tu proyecto con `pnpm db:types` cada vez que cambies el esquema.
- **El agente sin Google conectado** calcula los huecos con el horario de atención menos las citas ya registradas y guarda la reserva sólo en la BD. Así el sandbox y el desarrollo funcionan sin OAuth.
- **Varios mensajes seguidos**: si el cliente escribe tres mensajes cortos, sólo responde la ejecución del último (que ve los tres en el historial). Así se evitan respuestas duplicadas.

## Setup local

Requisitos: Node 20.9+ (probado con 24), pnpm 10+, un proyecto de Supabase y una API key de Anthropic.

```bash
pnpm install
cp .env.example .env.local   # completa los valores (ver "Variables de entorno")
pnpm dev                     # http://localhost:3000
```

Comandos útiles: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm db:types`.

### Base de datos (Supabase)

1. Crea un proyecto en [supabase.com](https://supabase.com) y copia la URL, la anon (o publishable) key y la service role (o secret) key en `.env.local`.
2. Aplica las migraciones:
   ```bash
   npx supabase login
   npx supabase link --project-ref <tu-project-ref>
   npx supabase db push
   pnpm db:types            # regenera lib/database.types.ts desde el proyecto enlazado
   ```
3. En **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (en producción, tu dominio).
   - Redirect URLs: `http://localhost:3000/callback` y `https://<tu-dominio>/callback`.
4. Realtime: la migración ya agrega `messages` y `conversations` a la publicación `supabase_realtime`.

La migración (`supabase/migrations/*_init.sql`) crea:

- las 9 tablas, con índices en `messages(conversation_id, created_at desc)`, `conversations(organization_id, last_message_at desc)`, `appointments(organization_id, starts_at)` y en las FK;
- las políticas RLS por `organization_id` (helper `private.current_org_id()`) y grants explícitos (nada para `anon`);
- el trigger de signup que crea la organización, el perfil (owner) y la configuración del agente con la plantilla dental;
- la RPC `conversations_per_day` (`security invoker`, respeta RLS) para el gráfico del dashboard.

**Seed de desarrollo** (`supabase/seed.sql`): crea el usuario `demo@example.com` / `demo1234` con conversaciones y citas de ejemplo. Se aplica solo con `npx supabase db reset` si usas Supabase local (requiere Docker: `npx supabase start`). Contra un proyecto remoto puedes pegarlo en el SQL Editor. **Nunca lo ejecutes en producción.**

## Configurar WhatsApp (Meta) paso a paso

Cada organización conecta su propio número desde **/integraciones**. Las credenciales se guardan cifradas en la BD, no en variables de entorno.

1. **Crea la app**: en [developers.facebook.com](https://developers.facebook.com/apps) → _Create app_ → tipo _Business_ → agrega el producto **WhatsApp**. Meta crea una WhatsApp Business Account (WABA) de prueba con un número de prueba.
2. **Número de prueba**: en _WhatsApp → API Setup_ agrega hasta 5 números destinatarios (el número de prueba sólo puede escribir a esos). Ahí mismo aparecen el **Phone Number ID** y el **WhatsApp Business Account ID**.
3. **Token permanente (System User)**: en [business.facebook.com](https://business.facebook.com) → _Business settings → Users → System users_ → crea un system user _Admin_ → _Assign assets_: la app (control total) y la WABA (control total) → _Generate new token_ para la app, con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`, sin vencimiento. No uses el token temporal de 24 h ni uno personal.
4. **App Secret**: en _App settings → Basic → App secret_.
5. **Guarda las credenciales** en `/integraciones` → _Credenciales_ (Phone Number ID, WABA ID, token y App Secret) y pulsa **Probar conexión** (`GET /v25.0/{phone_number_id}`). Al guardar por primera vez se genera un verify token aleatorio y único para tu organización.
6. **Webhook**: copia los datos de `/integraciones` → _Webhook en Meta_ y pégalos en _WhatsApp → Configuration → Webhook → Edit_:
   - Callback URL: `https://<tu-dominio>/api/webhooks/whatsapp` (se arma con `NEXT_PUBLIC_APP_URL`; el panel avisa si no es pública o no usa HTTPS).
   - Verify token: el que muestra el panel. Con _Generar nuevo verify token_ lo rotas; el webhook vuelve a quedar pendiente hasta que lo verifiques de nuevo en Meta.
   - _Verify and save_, y en _Webhook fields_ suscríbete a **`messages`**.
   - El panel muestra cuándo Meta verificó el webhook (`webhook_verified_at`) y cuándo llegó el último evento firmado (`last_event_at`), así sabes si la suscripción funciona.
7. **Suscribe la app a la WABA**: sin esto Meta no envía los mensajes a tu webhook (sólo aparecen en el visor de _webhooks de prueba_ del panel). La app lo hace sola al guardar las credenciales y al pulsar **Probar conexión**. Equivale a:
   ```bash
   curl -X POST "https://graph.facebook.com/v25.0/<WABA_ID>/subscribed_apps" \
     -H "Authorization: Bearer <SYSTEM_USER_TOKEN>"
   ```
8. **Prueba**: escribe desde un número autorizado al número de prueba, o usa _Test_ en la configuración del webhook. Los logs JSON del servidor muestran `whatsapp.webhook_received` y `whatsapp.message_processed`.

**Desarrollo local**: Meta exige un endpoint público con HTTPS válido (no autofirmado). Usa un túnel (`cloudflared tunnel --url http://localhost:3000` o `ngrok http 3000`) y pon esa URL en `NEXT_PUBLIC_APP_URL` y en Meta.

**Ventana de 24 h**: WhatsApp sólo permite texto libre dentro de las 24 h posteriores al último mensaje del cliente. Fuera de esa ventana Meta rechaza el envío (el panel muestra el error) y hacen falta plantillas aprobadas, que aún no están implementadas.

**Versión del Graph API**: centralizada en `lib/whatsapp/constants.ts` (`v25.0`, publicada el 18-feb-2026). Meta publica una versión cada ~3 meses y mantiene cada una ~2 años: revisa el [changelog](https://developers.facebook.com/docs/graph-api/changelog) antes de cada deploy.

### mTLS / trust store (importante si autohospedas)

Desde el **31 de marzo de 2026** Meta firma las llamadas a webhooks con una nueva **Meta Internal CA**. En **Vercel** no hay que hacer nada (el trust store gestionado ya la incluye). Si despliegas en tu propia infraestructura (Docker, EC2, un VPS con Nginx, etc.), el sistema o el proxy que termina TLS debe confiar en esa CA. Si no, el handshake falla y **dejas de recibir eventos sin ver ningún error en la app**. Agrega el certificado de la CA de Meta al trust store del sistema o al `ssl_client_certificate`/`ssl_trusted_certificate` de tu proxy y valida con _Test_ desde el panel de Meta.

## Configurar Google Calendar (OAuth 2.0)

1. En [Google Cloud Console](https://console.cloud.google.com) crea un proyecto y habilita **Google Calendar API**.
2. _APIs & Services → OAuth consent screen_: tipo _External_, agrega el scope `https://www.googleapis.com/auth/calendar` y, mientras esté en _Testing_, los correos de prueba.
3. _Credentials → Create credentials → OAuth client ID_ → _Web application_. En _Authorized redirect URIs_ agrega exactamente:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://<tu-dominio>/api/auth/google/callback`
4. Copia el Client ID y el Client Secret a `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, y la URI que corresponda a `GOOGLE_OAUTH_REDIRECT_URI`.
5. En `/integraciones` pulsa **Conectar con Google**, acepta y elige el calendario donde agendar.

Mientras la pantalla de consentimiento esté en _Testing_, Google hace expirar los refresh tokens a los 7 días. Para producción publica la app; el scope `calendar` es sensible y requiere verificación de Google.

## Variables de entorno

| Variable                                    | Dónde se usa       | Notas                                                 |
| ------------------------------------------- | ------------------ | ----------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                  | cliente y servidor | URL del proyecto                                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`             | cliente y servidor | anon key o publishable key (`sb_publishable_…`)       |
| `SUPABASE_SERVICE_ROLE_KEY`                 | sólo servidor      | service role o secret key (`sb_secret_…`); ignora RLS |
| `ANTHROPIC_API_KEY`                         | sólo servidor      | la lee `@ai-sdk/anthropic`                            |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | sólo servidor      | cliente OAuth web                                     |
| `GOOGLE_OAUTH_REDIRECT_URI`                 | sólo servidor      | igual a la configurada en Google                      |
| `ENCRYPTION_KEY`                            | sólo servidor      | 32 bytes en base64 para AES-256-GCM (`lib/crypto.ts`) |
| `NEXT_PUBLIC_APP_URL`                       | servidor           | URL pública sin barra final (webhook, links de email) |

Genera la clave de cifrado con `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Si la cambias, los tokens ya guardados dejan de descifrarse** y cada organización tiene que volver a guardar sus credenciales.

## Deploy en Vercel

1. Sube el repo a GitHub e impórtalo en Vercel (detecta Next.js y pnpm).
2. Carga todas las variables de entorno en _Settings → Environment Variables_, con `NEXT_PUBLIC_APP_URL=https://<tu-dominio>` y `GOOGLE_OAUTH_REDIRECT_URI=https://<tu-dominio>/api/auth/google/callback`.
3. Deploy. Después actualiza con el dominio final:
   - Supabase → Auth → Site URL y Redirect URLs (`/callback`).
   - Google Cloud → Authorized redirect URIs.
   - Meta → Callback URL del webhook.
4. El webhook corre en runtime Node (`export const runtime = 'nodejs'`), responde 200 de inmediato y procesa en `after()` con `maxDuration = 60`. Con Fluid Compute no hace falta configurar nada más.

## Cómo funciona el agente

- **System prompt** (`lib/agent/prompt.ts`): combina el prompt editable con el tono, la información del negocio, los servicios, el horario y el contexto del cliente, más reglas fijas. Las reglas son: ofrecer sólo horarios devueltos por la tool, reunir nombre, servicio, horario y (si está activado) si es cliente nuevo antes de reservar, nunca pedir el teléfono (sale del webhook) y pasar a una persona si no entiende o el cliente lo pide. Se arma en cada llamada, así que los cambios de `/personalizacion` aplican desde el siguiente mensaje.
- **Saludo**: sólo en el primer mensaje o tras 12 h de inactividad.
- **Historial**: últimos 30 mensajes de la conversación.
- **Idempotencia**: el webhook descarta `wa_message_id` repetidos (comprobación previa + `unique`). `book_appointment` no duplica la cita del mismo contacto en el mismo horario (consulta previa + índice único parcial).
- **Handoff**: `request_human_handoff` pone `bot_active = false`, envía el `handoff_message` y el panel muestra un aviso en tiempo real. El bot no vuelve a responder ese hilo hasta que el dueño lo reactive desde `/conversaciones/[id]`. _(TODO: notificación por email/push.)_
- **Sandbox** ("Probar agente" en `/personalizacion`): usa la configuración guardada y las mismas tools en modo simulación. Lee la disponibilidad real, pero no envía nada por WhatsApp ni escribe en la BD.

## Seguridad

- RLS habilitado en todas las tablas; políticas por `organization_id` con `to authenticated` y `with check`. El usuario no puede cambiar su `organization_id` ni su rol (grants por columna).
- Tokens de WhatsApp, App Secret y tokens de Google cifrados con AES-256-GCM. La service role sólo se usa en el servidor (`import "server-only"`).
- Todo POST del webhook se valida con HMAC-SHA256 sobre el body crudo, con comparación en tiempo constante.
- Logs estructurados en JSON (`lib/log.ts`) con `organization_id`, `wa_message_id`, `latency_ms` y `error`.
- `.env*` está en `.gitignore`; sólo se versiona `.env.example`.

## Checklist de aceptación (manual)

- [ ] Un mensaje al número recibe respuesta del agente en menos de 5 s (revisa `latency_ms` en `whatsapp.message_processed`).
- [ ] El agente pide nombre, servicio, horario y si es cliente nuevo antes de confirmar; el teléfono no lo pide.
- [ ] La cita aparece a la vez en Google Calendar y en `/citas`. Cancelarla la borra de Google; completarla le pone ✓.
- [ ] Con el bot desactivado en una conversación, los mensajes nuevos del cliente no se responden y aparecen en tiempo real en `/conversaciones/[id]`.
- [ ] Un cambio en el prompt de `/personalizacion` se nota en la siguiente respuesta (también en el sandbox).
- [ ] **Aislamiento**: crea dos cuentas (dos organizaciones) y comprueba que ninguna ve conversaciones, citas ni credenciales de la otra, ni en el panel ni consultando la API REST de Supabase con su sesión.
- [ ] El webhook responde 200 aunque falle el procesamiento posterior (p. ej. con una `ANTHROPIC_API_KEY` inválida); el error queda en el log `whatsapp.message_failed`.

## Estructura

```
proxy.ts                         sesión + protección de rutas (Next 16)
app/(marketing)/page.tsx         landing
app/(auth)/                      login, signup, callback, server actions de auth
app/(app)/                       panel: dashboard, conversaciones, citas, personalizacion, integraciones
app/api/webhooks/whatsapp/       webhook de Meta (GET verificación, POST eventos)
app/api/auth/google/callback/    callback de OAuth de Google
lib/agent/                       prompt, historial, slots, run (AI SDK) y tools/
lib/whatsapp/                    firma, envío, procesamiento, credenciales
lib/google/                      OAuth y Calendar REST
lib/supabase/                    clientes server / browser / admin / proxy
lib/crypto.ts  lib/time.ts  lib/log.ts  lib/database.types.ts
supabase/migrations/  supabase/seed.sql
```

## Pendiente / fuera de alcance

- Notificar el handoff por email o push (hoy sólo hay aviso en el panel vía Realtime).
- Plantillas de WhatsApp para escribir fuera de la ventana de 24 h.
- Interpretar audios e imágenes (hoy se guardan como `[audio]`, `[imagen]`).
- Webhook de cambios de Google Calendar (`/api/webhooks/google`, opcional en la especificación).
