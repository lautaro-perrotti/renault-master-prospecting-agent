# Operaciones

## Runtime recomendado

```text
docker compose up --build
```

Esto levanta `postgres`, `app`, `worker` y `scheduler`. Postgres usa `55432` solo para acceso desde Windows host; entre containers se usa `postgres:5432`.

## Desarrollo local

```text
docker compose up -d postgres
npm run db:migrate
npm run doctor
npm run dev
npm run worker
npm run scheduler
```

Mantener una sola instancia de `npm run dev`: además de HTTP mantiene el polling de Telegram. Si se corta el proceso, revisar que no haya otra instancia ocupando el puerto 3001 o realizando `getUpdates`.

## Modos y estado

- `MANUAL`: discovery, research y drafts pueden ejecutarse; el primer envío requiere aprobación.
- `SEMI_AUTO`: research y follow-ups pueden operar automáticamente; el primer envío requiere aprobación.
- `AUTO`: un `AUTO_ELIGIBLE` puede avanzar a `SEND` solo con `OUTREACH_ENABLED=true`.
- `/pause`: bloquea discovery y outreach nuevos, pero conserva control, replies y Sheets.
- `/stop`: bloquea envíos y follow-ups hasta `/resume`.

## Diagnóstico

```text
npm run doctor
npm run smoke
Invoke-WebRequest -UseBasicParsing http://localhost:3001/health/live
Invoke-WebRequest -UseBasicParsing http://localhost:3001/health
```

`/health/live` solo indica que el proceso está vivo. `/health` exige PostgreSQL, heartbeat reciente del worker y heartbeat reciente del scheduler. `doctor` separa configuración de validación real; `smoke` hace requests reales cuando hay credenciales.

## Cola y fallos

El worker usa `SKIP LOCKED`, lease de cinco minutos y heartbeat. Un job fallido vuelve a `PENDING` con backoff hasta `DEAD`. Revisar `jobs.last_error`, `audit_events` y las ejecuciones en `runs`.

Un mensaje en `RECONCILING` no debe reenviarse manualmente. El polling de replies intenta encontrar el `X-Renault-Idempotency-Key` en mensajes enviados y solo entonces lo marca como `SENT`.
