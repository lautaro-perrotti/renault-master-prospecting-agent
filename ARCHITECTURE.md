# Arquitectura

```text
Telegram -> casos de uso -> PostgreSQL <- workers persistentes <- scheduler
                         |-> discovery adapters -> crawler -> evidence
                         |-> qualification -> drafts -> Gmail -> replies
                         |-> Google Sheets sync
```

Los providers se abstraen por interfaces (`DiscoveryProvider`). La IA solo produce objetos validados y referencias a evidence existentes. El código controla persistencia, estados, locks, límites, supresiones, retries y auditoría.

La cola usa filas PostgreSQL, `FOR UPDATE SKIP LOCKED`, backoff exponencial y estado DEAD después de `max_attempts`. El modelo está preparado para separar API, worker y scheduler en procesos independientes.
