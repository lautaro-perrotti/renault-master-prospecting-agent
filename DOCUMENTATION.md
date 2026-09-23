# Estado operativo y decisiones

Fecha de actualizaciÃ³n: 2026-09-23

## Estado

El proyecto estÃ¡ en saneamiento integral. La auditorÃ­a inicial se conserva en [AUDIT.md](AUDIT.md). El flujo principal ya tiene una prueba e2e con PostgreSQL real y proveedores fake: discovery, clasificaciÃ³n, resoluciÃ³n, crawler fixture, evidencia, contacto, research, qualification AUTO, draft idempotente, exactamente un send, reply, notificaciÃ³n y Sheets projection fake.

## Decisiones

- PostgreSQL sigue siendo la fuente de verdad.
- Los resultados de bÃºsqueda se persisten como `raw_search_results` antes de clasificarse.
- Los dominios de Instagram, Facebook, LinkedIn, X, TikTok y YouTube nunca se guardan como dominio corporativo.
- `OUTREACH_ENABLED=false` por defecto. `AUTO` solo puede enviar cuando estÃ¡ habilitado explÃ­citamente.
- El modo efectivo se lee desde `configuration` en cada policy decision para que `/mode` afecte workers ya iniciados.
- Las suppressions se consultan de forma independiente por compaÃ±Ã­a, dominio y email.
- Gmail usa un `messageId` lÃ³gico y estados persistidos; una entrega incierta pasa a `RECONCILING` y no se reintenta ciegamente.
- La migraciÃ³n se registra por archivo en `migration_history`.
- El scheduler deduplica cada tick con una idempotency key basada en el tipo y el slot temporal.

## Comandos ejecutados

```text
npm run lint
npm run typecheck
npm test
$env:TEST_DATABASE_URL='postgres://prospecting:prospecting@localhost:55432/prospecting_test'
$env:RUN_PG_INTEGRATION='1'
npm test
npm run db:migrate
npm run build
```

## ValidaciÃ³n actual

- Lint: OK.
- Typecheck: OK.
- Unit/safety suite: OK.
- PostgreSQL integration: OK.
- Pipeline e2e: OK con PostgreSQL real y providers fake.
- Suite completa: 36 tests pasados.
- Build: OK.
- Docker Compose build: OK para app, worker y scheduler.
- Docker Compose runtime: OK; Postgres healthy, app/worker/scheduler activos y `/health` readiness devuelve `ok:true` con ambos heartbeats.
- Telegram: credencial configurada y `getMe` validado en la sesiÃ³n operativa.
- Brave, Places, OpenAI, Gmail y Sheets: dependen de credenciales; no se declaran validados sin smoke real.

## Problemas conocidos

- Falta implementar la consulta de reconciliaciÃ³n Gmail contra el proveedor para resolver de forma automÃ¡tica los mensajes `RECONCILING`.
- La creaciÃ³n de tabs de Sheets requiere completar el uso de metadata/batchUpdate para hojas que no existan.
- El feedback histÃ³rico de skips/blocks todavÃ­a no alimenta el planner entre runs.
- La suite de escenarios de fallos concurrentes todavÃ­a debe ampliarse, aunque la reserva transaccional y la deduplicaciÃ³n bÃ¡sica ya estÃ¡n conectadas.

## Regla de reporte

No se usa `PASS` para una integraciÃ³n que solo compila. Los estados se separan en `IMPLEMENTED`, `FAKE_TESTED`, `REAL_API_VALIDATED` y `NOT_CONFIGURED`.

## IteraciÃ³n transporte general â€” 2026-09-23

- Se agregÃ³ el modelo `useCase` (`REFRIGERATED`, `NON_REFRIGERATED`, `MIXED`, `UNKNOWN`) y `refrigerationFit` separado del ajuste general de transporte.
- El puntaje persistido ahora conserva necesidad de transporte, ajuste de vehÃ­culo, geografÃ­a, recurrencia, contacto y recencia, con mÃ¡ximo 100.
- La investigaciÃ³n estructurada exige referencias a evidencia persistida; referencias desconocidas fallan.
- El planner incluye vocabulario de reparto, distribuciÃ³n mayorista, logÃ­stica urbana y fleteros, ademÃ¡s de seÃ±ales refrigeradas.
- Se agregaron parsers puros para Brave y Google Places y smoke scripts condicionales.
- Telegram quedÃ³ fuera del alcance de esta iteraciÃ³n.
- ValidaciÃ³n de esta iteraciÃ³n: lint, typecheck y suite Vitest pasan; los smoke reales dependen de sus respectivas credenciales.
