# Renault Master Prospecting Agent

Agente comercial para detectar oportunidades de transporte para una Renault Master en CABA, GBA y AMBA. El modelo cubre cargas secas, refrigeradas y mixtas; la refrigeración es una capacidad adicional. PostgreSQL es la fuente de verdad, Telegram es el centro operativo y Sheets es una proyección.

## Estado verificable

El runtime actual tiene conectados:

- discovery con resultados crudos, clasificaciÃ³n, candidatos de entidad y resoluciÃ³n por dominio/nombre;
- planning bootstrap y estrategias derivadas con lÃ­mite de requests, tiempo y compaÃ±Ã­as;
- crawler HTTP que descubre enlaces internos y usa Playwright solo como fallback;
- contactos y evidencia con provenance;
- research estructurado con OpenAI cuando hay credencial y fallback determinista explÃ­cito cuando no la hay;
- qualification basada en evidencia y recency observada;
- drafting idempotente por campaÃ±a y step;
- policy de modo, supresiÃ³n, estado operativo y reserva transaccional de lÃ­mites;
- delivery con estados `READY`, `PREPARED`, `SENDING`, `SENT`, `RECONCILING` y `FAILED`;
- reply polling, follow-ups idempotentes y notificaciones Telegram;
- projection de seis tabs de Google Sheets;
- job worker con `SKIP LOCKED`, leases, heartbeat y retry/DEAD;
- scheduler persistente por slots y Docker Compose con Postgres, app, worker y scheduler.

La matriz histÃ³rica de la auditorÃ­a estÃ¡ en [AUDIT.md](AUDIT.md). Las capabilities que todavÃ­a requieren validaciÃ³n externa aparecen como `CONFIGURED`, `NOT_CONFIGURED` o `ERROR`; compilar no se considera validaciÃ³n.

## InstalaciÃ³n local

Requiere Node.js 22+, Docker y PostgreSQL. Para una instalaciÃ³n limpia:

```text
npm install
npx playwright install chromium
docker compose up -d postgres
npm run db:migrate
npm run doctor
```

En Windows host la base usa `postgres://prospecting:prospecting@localhost:55432/prospecting`. Dentro de Compose el runtime sobrescribe esa variable con `postgres://prospecting:prospecting@postgres:5432/prospecting`.

## Procesos

En terminales separadas para desarrollo local:

```text
npm run dev
npm run worker
npm run scheduler
```

O levantar el runtime completo:

```text
docker compose up --build
```

Postgres tiene healthcheck y los procesos dependientes esperan a que estÃ© healthy. No ejecutes una segunda instancia de `npm run dev`: el proceso de app mantiene el puerto configurado y el polling de Telegram.

## ConfiguraciÃ³n

Copiar `.env.example` a `.env`. Las credenciales permanecen fuera de git.

- `OUTREACH_MODE=MANUAL|SEMI_AUTO|AUTO` controla el policy engine.
- `OUTREACH_ENABLED=false` es el valor seguro inicial. Para habilitar delivery real hay que ponerlo explÃ­citamente en `true`.
- `AUTO` requiere `OUTREACH_ENABLED=true`, score mÃ­nimo, contacto vÃ¡lido, ausencia de supresiÃ³n, estado operativo `RUNNING` y un slot disponible.
- `TELEGRAM_ALLOWED_USER_IDS` restringe comandos y callbacks.
- `BRAVE_SEARCH_API_KEY` y `GOOGLE_MAPS_API_KEY` habilitan discovery real. Brave clasifica resultados antes de crear empresas y Places conserva placeId, dirección, coordenadas, teléfono, web y URL de Maps.
- `OPENAI_API_KEY` habilita research y clasificaciÃ³n de replies con OpenAI; sin esa credencial el runtime informa el fallback determinista.
- Gmail y Sheets usan OAuth con `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` y, para Sheets, `GOOGLE_SHEET_ID`.

## Telegram

La pantalla principal de Telegram estÃ¡ pensada como un panel operativo en espaÃ±ol. `/start` y `/inicio` muestran botones para buscar oportunidades, revisar leads, ver respuestas, consultar el estado y abrir la configuraciÃ³n.

Los aliases principales son `/buscar`, `/oportunidades`, `/respuestas`, `/estado`, `/configuracion`, `/ayuda`, `/pausar` y `/reanudar`. Los comandos tÃ©cnicos (`/search`, `/leads`, `/lead`, `/why`, `/research`, `/send`, `/skip`, `/block`, `/mode`, `/doctor`, entre otros) se mantienen para compatibilidad y diagnÃ³stico.

Las oportunidades se muestran con puntaje, ubicaciÃ³n, tipo de transporte traducido, evidencia resumida, contacto y estado humano. Las acciones de contacto, investigaciÃ³n, descarte y bloqueo usan botones inline y los mismos servicios de aplicaciÃ³n que los comandos.

Los comandos y botones usan el mismo `LeadActions`. `BLOCK` crea una suppression por empresa; una empresa bloqueada no se reactiva con rediscovery. `PAUSED` permite health, control, replies y Sheets, y bloquea discovery/outreach. `STOPPED` bloquea nuevos envÃ­os y follow-ups.

## Migraciones y datos

Las migraciones se registran en `migration_history` y se ejecutan una sola vez por versiÃ³n. Las tablas de lineage (`runs`, `search_queries`, `raw_search_results`, `entity_candidates`, `sources`, `evidence`, `research_results`) permiten reconstruir `/why <id>`.

El job queue acepta claves de idempotencia. Los envÃ­os tienen un `messageId` lÃ³gico estable, una sequence Ãºnica por compaÃ±Ã­a/campaÃ±a y un step Ãºnico por sequence.

## ValidaciÃ³n

```text
npm run lint
npm run typecheck
npm test
npm run build
npm run doctor
npm run smoke
```

Para PostgreSQL real e2e:

```powershell
$env:TEST_DATABASE_URL='postgres://prospecting:prospecting@localhost:55432/prospecting_test'
$env:RUN_PG_INTEGRATION='1'
npm test
```

La suite incluye unit tests, integraciÃ³n PostgreSQL, safety tests y un pipeline e2e con providers fake y PostgreSQL real que demuestra discovery, crawler, research con referencias de evidencia, qualification `AUTO_ELIGIBLE`, draft Ãºnico, exactamente un send, reply, notification y Sheets projection.

`npm run doctor` comprueba configuraciÃ³n y probes bÃ¡sicos. `npm run smoke` ejecuta requests reales para las APIs configuradas. También existen `npm run smoke:brave`, `npm run smoke:places` y `npm run smoke:openai`; cada uno devuelve `NOT_CONFIGURED`, `REAL_API_VALIDATED` o `ERROR` sin mostrar secretos. `NOT_CONFIGURED` no se presenta como PASS.

## Limitaciones conocidas

- El reconciliador Gmail para un timeout despuÃ©s de aceptaciÃ³n externa todavÃ­a debe consultar y resolver explÃ­citamente mensajes en estado `RECONCILING` antes de permitir otro intento.
- La proyecciÃ³n Sheets crea y actualiza filas con `internal_id`; la creaciÃ³n automÃ¡tica de tabs que no existan depende de permisos y metadata de la cuenta.
- La estrategia adaptativa aprende vocabulario de resultados del run actual; todavÃ­a no agrega feedback histÃ³rico de campaÃ±as rechazadas al planner.

## Discovery real

Para validar proveedores sin mostrar credenciales, completar en `.env` `BRAVE_SEARCH_API_KEY`, `GOOGLE_MAPS_API_KEY` y `OPENAI_API_KEY` según corresponda. Luego ejecutar `npm run smoke:brave`, `npm run smoke:places` y `npm run smoke:openai`. El experimento limitado se ejecuta con `npm run discovery:live -- --query "empresas con distribución propia en AMBA" --max-searches 5`; genera reportes JSON y Markdown en `reports/`. `OUTREACH_ENABLED=false` debe permanecer activo.

## Plantilla inicial de email

`EMAIL_TEMPLATE=transport-intro-v1` selecciona la plantilla local inicial para los drafts de outreach. Personaliza raz?n social, una evidencia p?blica persistida, cobertura CABA/GBA, capacidad del veh?culo y remitente. `OUTREACH_ENABLED=false` sigue bloqueando cualquier env?o.

## Gmail: validacion y drafts manuales

Gmail requiere `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_REFRESH_TOKEN`. La validacion real de la cuenta se ejecuta de forma independiente:

```text
npm run gmail:check
```

El comando realiza `users.getProfile` y solo informa `REAL_API_VALIDATED` si Gmail devuelve una cuenta. Para crear un borrador en Gmail se necesita el `messageId` logico persistido por el sistema:

```text
npm run gmail:draft -- --message-id <messageId>
```

El comando crea un draft en Gmail, guarda su `gmail_draft_id` y conserva el estado de outreach sin marcar el mensaje como enviado. Repetirlo para el mismo `messageId` devuelve el draft ya persistido. La operacion respeta suppression, requiere destinatario y cuerpo persistidos, y registra `GMAIL_DRAFT_CREATED`, `GMAIL_DRAFT_ALREADY_EXISTS` o `GMAIL_DRAFT_FAILED`.

No existe un comando de envio en esta iteracion. `OUTREACH_ENABLED=false` permanece activo y la creacion de drafts no habilita el envio automatico.

Para vincular Gmail de forma interactiva, configurar primero `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` y ejecutar:

```text
npm run gmail:oauth
```

El flujo solicita el consentimiento de Gmail y muestra el refresh token una sola vez. Guardarlo en `.env` como `GOOGLE_REFRESH_TOKEN`; no copiarlo al repositorio ni a los reportes.

La identidad del remitente configurada para los drafts es `R&M hnos. logistica`, `rymhermanos.logistica@gmail.com` y `1160397716`. Estos valores se usan únicamente en la firma del mensaje; el destinatario siempre debe provenir de un contacto prospectado persistido.
