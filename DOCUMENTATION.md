# Estado operativo y decisiones

Fecha de actualización: 2026-09-23

## Estado

El proyecto está en saneamiento integral. La auditoría inicial se conserva en [AUDIT.md](AUDIT.md). El flujo principal ya tiene una prueba e2e con PostgreSQL real y proveedores fake: discovery, clasificación, resolución, crawler fixture, evidencia, contacto, research, qualification AUTO, draft idempotente, exactamente un send, reply, notificación y Sheets projection fake.

## Decisiones

- PostgreSQL sigue siendo la fuente de verdad.
- Los resultados de búsqueda se persisten como `raw_search_results` antes de clasificarse.
- Los dominios de Instagram, Facebook, LinkedIn, X, TikTok y YouTube nunca se guardan como dominio corporativo.
- `OUTREACH_ENABLED=false` por defecto. `AUTO` solo puede enviar cuando está habilitado explícitamente.
- El modo efectivo se lee desde `configuration` en cada policy decision para que `/mode` afecte workers ya iniciados.
- Las suppressions se consultan de forma independiente por compañía, dominio y email.
- Gmail usa un `messageId` lógico y estados persistidos; una entrega incierta pasa a `RECONCILING` y no se reintenta ciegamente.
- La migración se registra por archivo en `migration_history`.
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

## Validación actual

- Lint: OK.
- Typecheck: OK.
- Unit/safety suite: OK.
- PostgreSQL integration: OK.
- Pipeline e2e: OK con PostgreSQL real y providers fake.
- Suite completa: 36 tests pasados.
- Build: OK.
- Docker Compose build: OK para app, worker y scheduler.
- Docker Compose runtime: OK; Postgres healthy, app/worker/scheduler activos y `/health` readiness devuelve `ok:true` con ambos heartbeats.
- Telegram: credencial configurada y `getMe` validado en la sesión operativa.
- Brave, Places, OpenAI, Gmail y Sheets: dependen de credenciales; no se declaran validados sin smoke real.

## Problemas conocidos

- Falta implementar la consulta de reconciliación Gmail contra el proveedor para resolver de forma automática los mensajes `RECONCILING`.
- La creación de tabs de Sheets requiere completar el uso de metadata/batchUpdate para hojas que no existan.
- El feedback histórico de skips/blocks todavía no alimenta el planner entre runs.
- La suite de escenarios de fallos concurrentes todavía debe ampliarse, aunque la reserva transaccional y la deduplicación básica ya están conectadas.

## Regla de reporte

No se usa `PASS` para una integración que solo compila. Los estados se separan en `IMPLEMENTED`, `FAKE_TESTED`, `REAL_API_VALIDATED` y `NOT_CONFIGURED`.
