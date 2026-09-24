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

## Validacion real de discovery - 2026-09-23

- Smoke real: Brave, Google Places y OpenAI respondieron correctamente. OpenAI uso `gpt-5.6-luna` en el smoke estructurado.
- Corrida limitada: 2 requests de busqueda, 40 resultados raw, 35 candidatos de entidad, 5 companias resueltas, 5 crawls y 5 investigaciones exitosas.
- Ultimo reporte: `reports/live-discovery-2026-09-23T21-56-00-904Z.json` y su Markdown asociado.
- OpenAI: 5 llamadas, 4 a `gpt-5.6-luna` y 1 escalada a `gpt-5.6-terra` por referencia de evidencia invalida; total 21.218 tokens reportados por la API.
- Costo: no estimado porque no hay precios configurados en el proyecto.
- `OUTREACH_ENABLED=false`; no se envio ningun mensaje.

## Defectos encontrados y corregidos con datos reales

- La unicidad global de resultados raw impedia conservar lineage por corrida; ahora la clave incluye `run_id`.
- El indice de evidencia sobre el texto completo superaba el limite de B-tree de PostgreSQL; ahora la deduplicacion usa `md5(excerpt)`.
- Una pagina de Cloudflare habia sido interpretada como telefono; se agrego limpieza reproducible y el extractor rechaza IPv4 y longitudes invalidas.
- Emails concatenados con etiquetas de la pagina se normalizan solo para TLDs conocidos; no se inventan direcciones.
- Una referencia de evidencia inexistente provoca escalada a Terra y, si falla nuevamente, error explicito.
- El crawler elimina scripts y estilos antes de persistir evidencia.

## Gate de calidad

- Providers y pipeline: `REAL_API_VALIDATED`.
- Calidad comercial: `DISCOVERY_REAL_BUT_NEEDS_TUNING`; el lote esta dominado por operadores logisticos y solo una de cinco empresas muestra evidencia explicita de cadena de frio. Las demas quedan para revision humana como posibles socios o capacidad complementaria.
- Telegram, Gmail, Sheets, OAuth y Docker quedaron fuera de esta iteracion.

## Tuning comercial por demanda externa - 2026-09-23

- Se agregaron `businessRole`, `transportDemandRole`, estado de flota propia y señales explícitas de tercerización.
- El puntaje ahora separa ajuste de operación (0-30) y demanda externa (0-30), con total de 100 junto con geografía, recurrencia, contacto y recencia.
- Operadores logísticos, carriers y couriers reciben una penalización cuando no hay señal de compra de capacidad externa. Una flota propia por sí sola no descarta un lead.
- El planner prioriza distribuidores, mayoristas, fabricantes, food service, importadores, e-commerce y señales de contratación de fleteros. Los avisos laborales se conservan como señal de compra y no como empresa.
- Se clasifican los contactos por rol y se preservan referencias a evidencia persistida en el research.
- El mapeo hacia la columna legacy `vehicle_fit` conserva su límite histórico de 25 mediante una conversión proporcional desde el nuevo rango 0-30.

### Reprocesamiento de los cinco leads anteriores

| Empresa | Score anterior | Score nuevo | Rol | Demanda |
|---|---:|---:|---|---|
| Distribuidora Metropolitana | 63 | 50 | LOGISTICS_OPERATOR | LIKELY_SELLER |
| Logistica Gitt | 73 | 94 | LOGISTICS_OPERATOR | BOTH |
| Tops Logistica | 88 | 58 | LOGISTICS_OPERATOR | LIKELY_SELLER |
| DYL Integral | 100 | 58 | LOGISTICS_OPERATOR | LIKELY_SELLER |
| Expreso Trole | 63 | 60 | LOGISTICS_OPERATOR | LIKELY_SELLER |

Gitt conserva prioridad por evidencia explícita de incorporación de personas con vehículo propio a su red de reparto. Los otros cuatro quedaron como vendedores de transporte sin evidencia pública suficiente de tercerización.

### Segunda corrida real

- Reporte: `reports/live-discovery-2026-09-23T22-55-28-312Z.json` y Markdown asociado.
- Providers: Brave, Google Places y OpenAI con requests reales; `OUTREACH_ENABLED=false`.
- 2 requests de búsqueda, 40 resultados raw, 38 candidatos, 15 compañías seleccionadas, 15 crawls, 14 investigaciones AI.
- Calidad: 2 GOOD, 11 MAYBE, 2 BAD, 0 COMPETITOR.
- Tasas: GOOD 13.3%, GOOD+MAYBE 86.7%, BAD 13.3%, COMPETITOR 0%.
- Refrigeración: 0 REFRIGERATED, 2 NON_REFRIGERATED, 12 MIXED, 1 UNKNOWN.
- Costos: 14 llamadas Luna, 0 Terra, 71.807 tokens; costo no estimado porque el proyecto no tiene precios configurados.
- El reporte conserva un error explícito para XPallet.com Argentina porque el crawl no dejó evidencia persistida suficiente para investigar. No se convirtió en éxito falso.

El gate de esta iteración es `TARGETING_NEEDS_TUNING`: la cobertura GOOD+MAYBE supera el objetivo inicial, pero GOOD todavía está por debajo de 40%. No se activó outreach ni se enviaron mensajes.

## Gmail y plantilla inicial - 2026-09-23

- El flujo de `DRAFT` usa la plantilla local versionada `transport-intro-v1`.
- La plantilla exige email v?lido, raz?n social, evidencia persistida, veh?culo, cobertura y remitente.
- Subject y body se generan de forma determinista y se persisten en `messages` con idempotencia por campa?a y step.
- La plantilla contempla transporte seco, refrigerado o mixto sin afirmar necesidades no verificadas.
- `OUTREACH_ENABLED=false` permanece activo. Esta iteraci?n no ejecut? Gmail ni envi? mensajes.
- La validaci?n OAuth/Gmail real queda para el siguiente paso cuando se configuren credenciales.

## Gmail: validacion de cuenta y drafts - 2026-09-23

- Se agrego `npm run gmail:check`, que ejecuta un request real `users.getProfile` cuando estan configuradas las tres credenciales OAuth y devuelve `REAL_API_VALIDATED`, `NOT_CONFIGURED` o `ERROR`.
- Se agrego `npm run gmail:draft -- --message-id <id>`, una operacion manual que llama `users.drafts.create` para el mensaje exacto persistido.
- La tabla `messages` guarda `gmail_draft_id` y `gmail_draft_message_id`, con indices unicos parciales en la migracion `0017_gmail_drafts.sql`.
- El draft conserva el `messageId` logico mediante `X-Renault-Idempotency-Key`; no cambia el estado a `SENT` y no se conecta al worker automatico.
- El handler vuelve a consultar suppression, exige destinatario/cuerpo persistidos y registra auditoria de creacion, repeticion o fallo.
- La prueba de Gmail disponible en esta etapa es MIME/unitaria. La cuenta solo se declara validada despues de ejecutar `npm run gmail:check` con OAuth real.
- Se agrego `npm run gmail:oauth` con scope exclusivo de Gmail (`gmail.modify`) para obtener el refresh token sin pedir permisos de Sheets.

## Identidad del remitente - 2026-09-23

- Se configuraron `SENDER_NAME`, `SENDER_EMAIL` y `SENDER_PHONE` para R&M hnos. logistica.
- La plantilla agrega esos datos a la firma del draft.
- El correo remitente real lo determina la cuenta autenticada en Gmail; `SENDER_EMAIL` no reemplaza la validacion OAuth.
