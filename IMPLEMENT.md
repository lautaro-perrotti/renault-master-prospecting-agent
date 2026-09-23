# Reglas

- PostgreSQL es source of truth; Sheets no reemplaza la base.
- Todas las APIs externas deben tener adapter, configuración explícita y estado `NOT_CONFIGURED`.
- No inventar datos, emails, evidencia ni estados exitosos.
- Toda evidencia guarda URL, extracto y timestamp.
- Toda IA usa salida estructurada validada y solo referencia evidence persistida.
- Toda operación mutante debe ser idempotente y auditable.
- No usar timers en memoria como única cola.
- No guardar secretos en código o logs.
- Ejecutar lint, typecheck y tests después de cada milestone.
