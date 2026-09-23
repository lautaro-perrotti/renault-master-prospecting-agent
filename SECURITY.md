# Seguridad

- No registrar API keys, OAuth tokens ni credenciales.
- Mantener `.env` fuera de git.
- Restringir Telegram mediante `TELEGRAM_ALLOWED_USER_IDS`.
- Gmail usa OAuth y scopes limitados.
- Toda supresión prevalece sobre el modo de operación.
- No generar emails por patrón: solo usar contactos públicos extraídos con URL.
- La IA no autoriza envíos ni puede crear evidencia.
