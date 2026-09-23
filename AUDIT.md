# Auditoría del runtime

Fecha: 2026-09-23

Esta auditoría describe el comportamiento que existe hoy en el código ejecutable. La presencia de un archivo o clase no se considera evidencia de que una capability esté implementada.

## Criterio

- **REAL**: está conectada al runtime y tiene comportamiento verificable.
- **PARTIAL**: existe y se usa, pero no cumple el contrato completo.
- **STUB**: existe una forma inicial, pero no hay operación continua o completa.
- **DEAD_CODE**: existe código que no participa del flujo.
- **NO_OP**: el handler recibe el trabajo y no ejecuta la capability.
- **BROKEN**: el camino operativo contradice el contrato o permite una violación crítica.

## Matriz

| Capability | DECLARED | ACTUAL | WIRED_TO_RUNTIME | TESTED | STATUS | Evidencia |
|---|---:|---|---:|---:|---|---|
| Discovery | Sí | Ejecuta providers sobre semillas estáticas | Sí | Parcial | PARTIAL | `src/discovery/engine.ts`, `query-generator.ts` |
| Adaptive Search Planning | Sí | Solo genera queries iniciales; no aprende ni detiene por presupuesto | No | No | PARTIAL | `src/discovery/query-generator.ts`, `engine.ts` |
| Google Places | Sí | Provider HTTP usable desde discovery | Sí | Parcial | PARTIAL | `src/discovery/google-places.ts` |
| Brave | Sí | Provider HTTP usable, pero trata cada resultado como empresa | Sí | Parcial | PARTIAL | `src/discovery/brave-search.ts` |
| Social Search | Sí | Usa dominios de plataformas como dominio empresarial | Sí | No | BROKEN | `src/discovery/social-search.ts` |
| Entity Resolution | Sí | Deduplica por dominio/nombre sin candidatos ni clasificación | Sí | Parcial | BROKEN | `src/jobs/handlers.ts`, `src/enrichment/company.ts` |
| Website Crawler | Sí | Prueba rutas fijas y descarta texto sin keyword; abre browser por URL | Sí | Parcial | PARTIAL | `src/crawler/website.ts` |
| Contact Extraction | Sí | Regex básica de email/teléfono | Sí | Parcial | PARTIAL | `src/enrichment/contacts.ts` |
| AI Research | Sí | El archivo existe, pero `RESEARCH` llama a `qualify()` | No | Unitario | DEAD_CODE | `src/qualification/ai-research.ts`, `src/jobs/handlers.ts` |
| Qualification | Sí | Scoring regex; recency siempre verdadera | Sí | Unitario | PARTIAL | `src/qualification/scorer.ts` |
| Drafting | Sí | Genera mensaje, pero crea sequence nueva en cada ejecución | Sí | Unitario | PARTIAL | `src/jobs/handlers.ts`, `composer.ts` |
| MANUAL mode | Sí | Policy exige aprobación inicial | Sí | Unitario | REAL | `src/outreach/policy.ts` |
| SEMI_AUTO mode | Sí | Policy distingue follow-up, sin workflow completo | Sí | Unitario | PARTIAL | `src/outreach/policy.ts` |
| AUTO mode | Sí | Puede calificar, pero nunca encola SEND automáticamente | Sí | Unitario | BROKEN | `src/jobs/handlers.ts` |
| Gmail Initial Send | Sí | Usa Gmail API directo sin reconciliación ni idempotencia real | Sí | No | BROKEN | `src/outreach/gmail.ts`, `handlers.ts` |
| Reply Processing | Sí | Lista inbox y clasifica; sin cursor persistente | Sí | Unitario | PARTIAL | `src/jobs/handlers.ts`, `replies/` |
| Follow-ups | Sí | Puede crear `SENDING` y perderlo; bypass parcial de policy | Sí | Parcial | BROKEN | `src/jobs/handlers.ts` |
| Suppression | Sí | JOIN excluye suppressions solo por email | Sí | No | BROKEN | `src/jobs/handlers.ts` |
| Rate Limits | Sí | SELECT + comparación sin reserva transaccional | Sí | No | BROKEN | `src/jobs/handlers.ts` |
| Telegram Commands | Sí | Comandos principales en bot | Sí | No | PARTIAL | `src/telegram/bot.ts` |
| Telegram Callbacks | Sí | `skip` y `block` encolan `QUALIFY` | Sí | No | BROKEN | `src/telegram/bot.ts` |
| Telegram Notifications | Sí | No existe notifier usado por workers | No | No | DEAD_CODE | No hay camino runtime |
| Google Sheets | Sí | Clase disponible; job retorna inmediatamente | No | Unitario | NO_OP | `src/jobs/handlers.ts`, `src/integrations/sheets.ts` |
| Scheduler | Sí | `schedule()` encola una sola vez y no se inicia | No | No | STUB | `src/scheduler.ts`, `src/app/main.ts` |
| Worker | Sí | Loop de jobs disponible por comando separado | Sí | Integración | REAL | `src/jobs/worker.ts`, `main.ts` |
| Job Queue | Sí | `SKIP LOCKED`, retry y DEAD básicos; sin dedupe/heartbeat | Sí | Integración | PARTIAL | `src/jobs/queue.ts` |
| Docker Runtime | Sí | Solo postgres y app; app apunta al host y no hay worker/scheduler | Sí | No | BROKEN | `docker-compose.yml` |
| Health | Sí | Postgres/Telegram/Playwright reales; APIs configuradas se marcan ERROR sin request | Sí | Parcial | BROKEN | `src/integrations/health.ts` |
| Smoke Tests | Sí | Reutiliza doctor y no ejecuta smoke por provider | Sí | No | BROKEN | `src/app/main.ts`, `health.ts` |
| Audit Trail | Sí | Tabla existe, pero la mayoría de decisiones no registra eventos | Parcial | No | PARTIAL | `src/db/schema.ts`, `handlers.ts` |

## Conteo

| Estado | Cantidad |
|---|---:|
| REAL | 2 |
| PARTIAL | 13 |
| STUB | 1 |
| DEAD_CODE | 2 |
| NO_OP | 1 |
| BROKEN | 11 |
| **Total** | **30** |

## Blockers del flujo principal

1. El discovery no clasifica resultados antes de crear empresas.
2. La resolución de identidad puede mezclar perfiles sociales y empresas distintas.
3. Research no llama al proveedor de IA.
4. AUTO no llega a SEND.
5. No hay scheduler ni runtime Docker completo.
6. Suppression y límites permiten violaciones bajo casos concretos.
7. Gmail no tiene recuperación segura ante timeout/crash.
8. Sheets, notifier y callbacks no están conectados de forma correcta.

La implementación no puede declararse completa hasta cerrar estos blockers con pruebas de comportamiento.

## Estado después del saneamiento actual

Se conectaron y probaron con PostgreSQL real: clasificación de resultados, separación de perfiles sociales, entity candidate, crawler injectable, research con validación de evidence IDs, qualification determinista, drafting idempotente, policy AUTO, reservation de límites, suppression email-only, reply processing, notifier, scheduler, worker heartbeat, Sheets projection y Docker runtime.

El estado global sigue siendo **FAIL** para la definición final de producto porque faltan la reconciliación Gmail completa contra casos de timeout reales, la prueba de concurrencia de los últimos slots con múltiples workers y la validación real de Brave, Places, OpenAI, Gmail y Sheets, que no tienen credenciales configuradas en esta instalación.
