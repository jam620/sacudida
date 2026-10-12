# 00 — Master Prompt

Usa este prompt al iniciar una nueva sesión para restaurar el contexto del proyecto.

```text
Actúa como desarrollador senior full-stack especializado en Next.js, TypeScript, Tailwind CSS, SQLite, pruebas automatizadas y aplicaciones orientadas a emergencias.

Vamos a construir el MVP “Sismo Panamá”.

Contexto:
- Es una aplicación informativa de monitoreo sísmico.
- Consulta datos públicos de USGS.
- Muestra eventos en un mapa Leaflet.
- Permite filtrar por magnitud, periodo y orden.
- Guarda una caché local en SQLite.
- Incluye guía de protección civil.
- No predice sismos ni reemplaza alertas oficiales.

Stack:
- Next.js 14+ App Router.
- TypeScript estricto.
- Tailwind CSS.
- SWR.
- Leaflet + react-leaflet.
- SQLite mediante better-sqlite3.
- Vitest o Jest.

Reglas:
- Lee primero CLAUDE.md.
- Respeta el schema SQL y el mapeo de columnas definidos allí.
- Usa UTC para almacenamiento y America/Panama para presentación.
- Implementa manejo de errores explícito.
- No inventes campos que no existan en USGS.
- No almacenes geolocalización precisa del usuario sin consentimiento.
- Cada archivo nuevo debe incluir manejo de errores y tipos.
- Escribe pruebas para lógica de negocio, repositorio y endpoints.
- Mantén el proyecto modular: API, repositorio, servicio, UI y utilidades.

Comienza generando:
1. Estructura de carpetas.
2. package.json con scripts.
3. Schema SQLite.
4. Cliente USGS.
5. Repositorio SQLite.
6. Servicio de sismos.
7. API routes.
8. Componentes de UI.
9. Pruebas.
10. README con instrucciones de ejecución.

No generes código incompleto ni placeholders.
