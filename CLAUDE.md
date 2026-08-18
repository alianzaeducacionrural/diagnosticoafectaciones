# CLAUDE.md

Guía para trabajar en este repositorio.

## Qué es esto

Formulario público para que los padrinos del Comité de Cafeteros de Caldas reporten, sede por
sede, los daños que dejó un sismo en las instituciones educativas rurales del departamento.
Cada envío guarda una fila en Google Sheets y sube fotos, videos o documentos (PDF/Word/Excel)
a una carpeta de Drive organizada `Municipio / Institución / Sede` — todas las evidencias de una
sede quedan juntas ahí, sin subcarpetas por tipo (el nombre del archivo ya distingue FOTO/
VIDEO/DOC).

No hace falta completar todo de una vez: una sede se puede guardar solo con municipio,
institución y sede (queda como "Borrador"), y el padrino la retoma después desde "Tus reportes
guardados" para agregar nivel, descripción o evidencia — sin duplicar la fila.

## Ejecutar el proyecto

Sitio estático sin build ni dependencias. Abre [index.html](index.html) directo en el
navegador, o sírvelo con `npx serve .` / Live Server. Necesita conexión a internet siempre
(carga los catálogos desde Apps Script al arrancar).

## Arquitectura

```
index.html + css/styles.css + js/{config,upload,form}.js   (estático, sin framework)
                    ↓ fetch (GET/POST, Content-Type: text/plain)
gas/Code.gs   (Apps Script standalone, desplegado como Web App)
                    ↓
Google Sheets "Daños por sismo — Registro"  (registros · padrinos · asignacion)
Google Drive "Encuesta de daños por sismo"  (evidencias, árbol de carpetas)
```

**Archivos**
- [js/config.js](js/config.js) — `CONFIG.GAS_URL` y los parámetros de compresión/subida.
- [js/upload.js](js/upload.js) — compresión de fotos (canvas) y subida de fotos/videos
  **directo del navegador a Drive** vía sesión de subida reanudable (el backend solo firma la
  sesión; nunca ve los bytes del archivo). Ver la nota de diseño más abajo.
- [js/form.js](js/form.js) — toda la lógica: catálogos, cascadas Municipio→Institución→Sede,
  repetidores de institución/sede (clonado de `<template>`), borrador en `localStorage`,
  validación, envío secuencial sede por sede con reintento de fallidas.
- [gas/Code.gs](gas/Code.gs) — backend. Contiene embebidos como constantes JS el catálogo
  `MUN_IE_SEDE` (771 sedes, 26 municipios de Caldas, excluye Manizales y La Pintada) y las
  semillas `PADRINOS_SEED`/`ASIGNACION_SEED` usadas solo la primera vez que corre
  `inicializar()`. Si el catálogo de sedes cambia, se actualiza aquí a mano.

**Contrato del backend** (mismo patrón `{ ok, data | error }` que el resto de proyectos GAS
del usuario — ver `Plataformas/Seguimiento a egresados/gas/Code.gs` y
`Plataformas/Encuestas diagnostico proyectos/gas/Code.gs`):

| Método | `accion` | Devuelve |
|---|---|---|
| GET | `catalogos` | `{ padrinos, geo, asignacion, registradas }` |
| GET | `misRegistros&padrino=Nombre` | sedes ya guardadas por ese padrino (Borrador o Completo) |
| GET | `todosLosRegistros` | TODAS las sedes de TODOS los padrinos — usado por el dashboard |
| POST | `iniciarSede` | crea/reutiliza la carpeta de la sede; bloquea solo si es de OTRO padrino |
| POST | `sesionSubida` | firma una sesión de subida reanudable de Drive API v3 |
| POST | `guardarSede` | upsert: si la fila es del mismo padrino la actualiza, si no la crea |

Acciones de mantenimiento de uso único/ocasional, protegidas con `ADMIN_KEY` (no es
autenticación real, solo evita activarlas por accidente): `resembrarCatalogos`,
`compartirEvidencias`, `migrarEstructuraCarpetas` (acepta `dryRun`), `limpiarHuerfanos` (acepta
`dryRun` — compara cada carpeta de sede contra la lista de evidencias del Sheet y manda a la
papelera lo que no está referenciado), `carpetasSinRegistro` (solo lectura — carpetas con
archivos pero sin fila en `registros`, típicamente envíos que fallaron a mitad de camino),
`listarCarpeta` (solo lectura — archivos y subcarpetas de una carpeta puntual, para verificar a
mano si una subida llegó a Drive).

`RESULTS_SHEET_ID` está hardcodeado en `Code.gs` (el spreadsheet ya existe, no lo crea el
script). El duplicado se detecta por clave natural `Municipio|Institución|Sede`
(`buscarFilaSede_`) — es lo que permite reabrir y actualizar la misma fila en vez de bloquear al
propio padrino.

El `POST` siempre usa `Content-Type: text/plain` con body `JSON.stringify(...)` — es
intencional, evita el preflight CORS que Apps Script no maneja. **No cambiarlo a
`application/json`.**

## Panel de control (`dashboard.html`)

Página aparte, sin enlace desde `index.html` — para uso interno del programa, no de los
padrinos. Trae **todas** las sedes de **todos** los padrinos (`accion=todosLosRegistros`) y el
catálogo completo (`accion=catalogos`, para calcular cobertura sobre las 771 sedes). Sin build,
sin librería de gráficos: las barras son `<div>` con `width`/CSS, al estilo de la skill
`dataviz`. El nivel de afectación se trata como una placa de inspección de edificios (verde /
amarillo-oliva / ámbar / terracota / rojo, escala tipo ATC-20) — mismo componente
`.placa-nivel` reutilizado en tabla, panel de detalle y leyendas de los gráficos. El detalle de
sede y el modal de previsualización de evidencia son una copia deliberada de la lógica de
`js/form.js`/`renderArchivosExistentes` — dos páginas estáticas sin build, no vale la pena
extraer un módulo compartido para esto.

## Por qué los videos no pasan por Apps Script

Reensamblar archivos grandes dentro de Apps Script revienta la memoria (el techo práctico de
un blob en GAS ronda 50 MB) y el script muere a los 6 minutos. En su lugar:

1. El navegador pide a `gas/Code.gs` (`accion=sesionSubida`) una sesión de subida reanudable.
2. El GAS, con `ScriptApp.getOAuthToken()`, firma esa sesión ante la Drive API y devuelve la
   URL `Location`.
3. El navegador sube los bytes **directo a Google** en trozos de `CONFIG.TAMANO_TROZO` (8 MiB),
   con reintento (3 intentos, backoff 1s/2s/4s) por trozo.

Límite conocido: si hay que reintentar una sede completa tras un corte de red, el archivo se
sube desde cero (no hay reanudación persistida entre sesiones del navegador) — puede quedar un
archivo duplicado en Drive del intento anterior; se borra a mano si pasa.

## Despliegue del backend — usa `clasp`, no copiar/pegar

El proyecto está vinculado a Apps Script vía `gas/.clasp.json` (cuenta
`edurural.osorio.alejandro@gmail.com`, ya logueada en este equipo). Para publicar cambios:

```bash
cd gas
clasp push --force
clasp list-deployments              # copiar el deploymentId de la versión activa (no @HEAD)
clasp update-deployment <deploymentId>   # mantiene la misma URL /exec
```

Ver [SETUP.md](SETUP.md) para el detalle completo, incluido el único paso manual del proyecto:
la autorización de permisos (Drive/Sheets) que Google exige aprobar una vez desde el navegador
— eso ninguna CLI puede automatizarlo, es una pared de seguridad de Google, no de `clasp`.

## Convenciones

- Español, kebab-case en CSS, nombres de función descriptivos en español (`agregarSede`,
  `refrescarSedesDeInstitucion`, `claveSede`) — mismo estilo que el resto de proyectos GAS del
  usuario.
- Sin frameworks, sin build. `<template>` + clonado de nodos para los repetidores, en vez de
  un framework de componentes.
- Nombre de archivo de evidencias: `SISMO-ddMMyy-FOTO-MUNICIPIO-INSTITUCION-SEDE-01.ext`
  (`construirNombreBase` en [js/upload.js](js/upload.js)).
