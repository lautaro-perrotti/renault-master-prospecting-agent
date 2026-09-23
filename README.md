# Renault Master Prospecting Agent

Agente comercial para encontrar oportunidades de transporte refrigerado para una Renault Master en CABA, GBA y AMBA. PostgreSQL es la fuente de verdad, Telegram es el centro operativo y Sheets es una proyección.

## Estado verificable

El runtime actual tiene conectados:

- discovery con resultados crudos, clasificación, candidatos de entidad y resolución por dominio/nombre;
- planning bootstrap y estrategias derivadas con límite de requests, tiempo y compañías;
- crawler HTTP que descubre enlaces internos y usa Playwright solo como fallback;
- contactos y evidencia con provenance;
- research estructurado con OpenAI cuando hay credencial y fallback determinista explícito cuando no la hay;
- qualification basada en evidencia y recency observada;
- drafting idempotente por campaña y step;
- policy de modo, supresión, estado operativo y reserva transaccional de límites;
- delivery con estados `READY`, `PREPARED`, `SENDING`, `SENT`, `RECONCILING` y `FAILED`;
- reply polling, follow-ups idempotentes y notificaciones Telegram;
- projection de seis tabs de Google Sheets;
- job worker con `SKIP LOCKED`, leases, heartbeat y retry/DEAD;
- scheduler persistente por slots y Docker Compose con Postgres, app, worker y scheduler.

La matriz histórica de la auditoría está en [AUDIT.md](AUDIT.md). Las capabilities que todavía requieren validación externa aparecen como `CONFIGURED`, `NOT_CONFIGURED` o `ERROR`; compilar no se considera validación.

## Instalación local

Requiere Node.js 22+, Docker y PostgreSQL. Para una instalación limpia:

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

Postgres tiene healthcheck y los procesos dependientes esperan a que esté healthy. No ejecutes una segunda instancia de `npm run dev`: el proceso de app mantiene el puerto configurado y el polling de Telegram.

## Configuración

Copiar `.env.example` a `.env`. Las credenciales permanecen fuera de git.

- `OUTREACH_MODE=MANUAL|SEMI_AUTO|AUTO` controla el policy engine.
- `OUTREACH_ENABLED=false` es el valor seguro inicial. Para habilitar delivery real hay que ponerlo explícitamente en `true`.
- `AUTO` requiere `OUTREACH_ENABLED=true`, score mínimo, contacto válido, ausencia de supresión, estado operativo `RUNNING` y un slot disponible.
- `TELEGRAM_ALLOWED_USER_IDS` restringe comandos y callbacks.
- `BRAVE_SEARCH_API_KEY` y `GOOGLE_MAPS_API_KEY` habilitan discovery.
- `OPENAI_API_KEY` habilita research y clasificación de replies con OpenAI; sin esa credencial el runtime informa el fallback determinista.
- Gmail y Sheets usan OAuth con `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` y, para Sheets, `GOOGLE_SHEET_ID`.

## Telegram

Comandos: `/start`, `/help`, `/status`, `/stats`, `/search`, `/discovery`, `/leads`, `/lead`, `/why`, `/research`, `/send`, `/skip`, `/block`, `/replies`, `/errors`, `/pause`, `/resume`, `/stop`, `/mode`, `/config` y `/doctor`.

Los comandos y botones usan el mismo `LeadActions`. `BLOCK` crea una suppression por empresa; una empresa bloqueada no se reactiva con rediscovery. `PAUSED` permite health, control, replies y Sheets, y bloquea discovery/outreach. `STOPPED` bloquea nuevos envíos y follow-ups.

## Migraciones y datos

Las migraciones se registran en `migration_history` y se ejecutan una sola vez por versión. Las tablas de lineage (`runs`, `search_queries`, `raw_search_results`, `entity_candidates`, `sources`, `evidence`, `research_results`) permiten reconstruir `/why <id>`.

El job queue acepta claves de idempotencia. Los envíos tienen un `messageId` lógico estable, una sequence única por compañía/campaña y un step único por sequence.

## Validación

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

La suite incluye unit tests, integración PostgreSQL, safety tests y un pipeline e2e con providers fake y PostgreSQL real que demuestra discovery, crawler, research con referencias de evidencia, qualification `AUTO_ELIGIBLE`, draft único, exactamente un send, reply, notification y Sheets projection.

`npm run doctor` comprueba configuración y probes básicos. `npm run smoke` ejecuta requests reales para las APIs configuradas. `NOT_CONFIGURED` no se presenta como PASS.

## Limitaciones conocidas

- El reconciliador Gmail para un timeout después de aceptación externa todavía debe consultar y resolver explícitamente mensajes en estado `RECONCILING` antes de permitir otro intento.
- La proyección Sheets crea y actualiza filas con `internal_id`; la creación automática de tabs que no existan depende de permisos y metadata de la cuenta.
- La estrategia adaptativa aprende vocabulario de resultados del run actual; todavía no agrega feedback histórico de campañas rechazadas al planner.
