# Instrucciones permanentes

- No hacer commit ni push sin autorización explícita.
- No borrar archivos fuera de este proyecto.
- Una capability existe solo si está conectada al runtime, persiste su estado, maneja errores y tiene una prueba observable.
- No convertir resultados web en empresas sin clasificación y resolución de identidad.
- No usar dominios de plataformas sociales como identidad corporativa.
- No inventar emails, evidencia, necesidades ni estados de éxito.
- Toda señal de IA debe validar sus referencias contra evidence persistida.
- Toda acción de outreach debe pasar por policy, suppression, estado operativo y límites.
- Un send debe recibir un `messageId` lógico; nunca seleccionar un mensaje arbitrario por compañía.
- Los errores transitorios solo se reintentan cuando la operación es segura o reconciliable.
- Mantener audit trail para decisiones, cambios de estado y fallos relevantes.
- Después de cada milestone ejecutar `npm run lint`, `npm run typecheck` y `npm test`.
- No presentar una integración como validada si no recibió un request real o una prueba e2e explícita.
