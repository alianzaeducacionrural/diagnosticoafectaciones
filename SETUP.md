# Despliegue — Encuesta de Daños por Sismo

## Ya hecho automáticamente (vía `clasp` y la conexión de Drive)

- Se creó el spreadsheet de resultados **"Daños por sismo — Registro"** directo dentro de la
  carpeta "Encuesta de daños por sismo" en Drive (así el backend no necesita crear ni mover
  nada — evita depender del permiso de creación en el primer arranque).
- Se creó un proyecto de Apps Script standalone: `gas/Code.gs` + `gas/appsscript.json`, apuntando
  a ese spreadsheet (`RESULTS_SHEET_ID` hardcodeado en `Code.gs`).
- Se subió el código (`clasp push`) y se desplegó como Web App pública (`clasp deploy`,
  luego actualizado con `clasp update-deployment` cada vez que cambia el código).
- La URL `/exec` ya está puesta en [js/config.js](js/config.js).

| Recurso | Valor |
|---|---|
| Script ID | `1HEXQU-WSJPYap5Fwuo7xXKvyS91k5NrmZeW8eNLRy2MfYddt2TYl-6CV` |
| Editor del script | https://script.google.com/d/1HEXQU-WSJPYap5Fwuo7xXKvyS91k5NrmZeW8eNLRy2MfYddt2TYl-6CV/edit |
| URL del Web App | https://script.google.com/macros/s/AKfycbyNsPIN3vvgG2oGL4Oa8SEmzMjKZEIAYJ042XyhBQVO6rJHRClB89IQGrZFw0I0YQyXrw/exec |
| Spreadsheet de resultados | https://docs.google.com/spreadsheets/d/1u7P_zM9iZMSTxisU_Ng0FdyHWWnwpSrRjSYLvjP-bKI/edit |
| Cuenta que ejecuta el backend | `edurural.osorio.alejandro@gmail.com` (misma dueña del Sheet maestro y la carpeta de Drive) |

## Único paso manual que falta (una vez, ~30 segundos)

Google exige que un humano apruebe, con un clic en el navegador, la primera vez que un script
pide permiso para tocar Drive y Sheets — ninguna herramienta de línea de comandos (ni `clasp`)
puede completar ese clic por ti. Es la única parte de todo el despliegue que no se pudo
automatizar.

1. Abre el editor del script (enlace arriba), con la cuenta `edurural.osorio.alejandro@gmail.com`.
2. En el desplegable de funciones (arriba, junto al botón ▷ Ejecutar), elige **`inicializar`**.
3. Haz clic en **Ejecutar**.
4. Aparecerá "Se requiere autorización" → **Revisar permisos** → elige la cuenta →
   como el proyecto no está verificado por Google (es normal en scripts personales), haz clic en
   **Avanzado** → **Ir a Encuesta de Daños por sismo — Backend (no seguro)** → **Permitir**.
5. `inicializar()` se ejecuta: crea (si faltan) las 3 pestañas del spreadsheet de resultados
   (`registros`, `padrinos`, `asignacion`) y siembra `padrinos` (20 filas) y `asignacion`
   (27 filas). El spreadsheet en sí ya existe — este paso solo prepara sus pestañas.
6. En el panel de **Ejecuciones** (ícono de reloj a la izquierda) confirma que terminó sin error,
   y revisa el **Registro** (`Ver → Registros`, o `Ctrl+Enter`) — debe mostrar la URL del
   spreadsheet.

Con eso, el backend queda operativo permanentemente: cualquier padrino que abra el formulario
público NO necesita autorizar nada — el Web App corre siempre como la cuenta dueña.

## Verificar que quedó bien

Abre esta URL en el navegador (debe devolver JSON, no HTML de error):

```
https://script.google.com/macros/s/AKfycbyNsPIN3vvgG2oGL4Oa8SEmzMjKZEIAYJ042XyhBQVO6rJHRClB89IQGrZFw0I0YQyXrw/exec?accion=catalogos
```

Debe traer `"ok":true` y, dentro de `data`: 20 `padrinos`, `geo` con 26 municipios (sin
Manizales ni La Pintada), `asignacion` con 27 filas y `registradas` vacío (`[]`) la primera vez.

## Guardado parcial (Borrador) y edición posterior

El formulario NO exige nivel de afectación, descripción ni evidencia para guardar una sede —
solo municipio, institución, sede y los datos de contacto. Al enviar, cada sede queda en la
pestaña `registros` con una columna `Estado`:

- **Borrador**: falta descripción o evidencia.
- **Completo**: tiene descripción y al menos una foto, video o documento.

Cuando un padrino selecciona su nombre, el formulario carga automáticamente sus sedes ya
guardadas (`GET ?accion=misRegistros&padrino=...`) en la sección "Tus reportes guardados", con
un botón "Continuar / editar" que precarga esa sede para completarla — el backend actualiza la
misma fila (no crea una nueva) mientras sea el mismo padrino. Si otro padrino intenta guardar
esa misma sede, sigue bloqueado como antes.

La columna `Evidencias (JSON)` guarda un array `[{nombre, url, tipo}]` en vez de texto plano —
es lo que permite al formulario, al reabrir una sede, saber exactamente qué fotos/videos ya
están subidas sin tener que volver a leerlas de Drive.

## Corregir los municipios sin padrino real

En `Asignación.xlsx`, los municipios **Belalcázar, La Merced, Palestina y Villamaría** están
asignados a *"Jhonatan"* y *"Federico"*, que no tienen correo ni teléfono en la pestaña
`Padrinos` del sheet maestro. Mientras tanto esos 4 municipios funcionan igual en el formulario,
solo que no aparecen en "Tus municipios" para nadie.

Para corregirlo cuando tengas sus datos: abre el spreadsheet de resultados (pestaña `padrinos`)
y agrega la fila con nombre/correo/teléfono; luego en la pestaña `asignacion` reemplaza
"Jhonatan"/"Federico" por el nombre exacto que agregaste. No hace falta tocar el código ni
volver a desplegar — el formulario lee estas pestañas en cada carga.

## Frontend ya publicado (GitHub Pages)

- Repositorio: https://github.com/alianzaeducacionrural/diagnosticoafectaciones
- Sitio: **https://alianzaeducacionrural.github.io/diagnosticoafectaciones/**
- Pages activado sobre la rama `main`, carpeta raíz (`/`) — sin build, sin `npm install`.

Para publicar cambios más adelante:

```bash
cd "Encuesta Daños por sismo"
git add -A
git commit -m "descripción del cambio"
git push
```

GitHub Pages reconstruye solo tras cada push (unos segundos a un par de minutos). Ojo con
mayúsculas en las rutas (`css/`, `js/` en minúscula) — GitHub Pages es sensible a
mayúsculas/minúsculas aunque Windows no lo sea; ya causó dos commits de arreglo en el proyecto
`encuestaucampo`.

`Asignación.xlsx` se dejó fuera del repositorio a propósito (era solo la fuente de datos para
sembrar `Code.gs`; ya no lo usa el sistema en producción).

## Modificar el backend más adelante

El proyecto ya quedó vinculado a `clasp` (`gas/.clasp.json`). Para subir cambios de código:

```bash
cd "Encuesta Daños por sismo/gas"
clasp push --force
clasp list-deployments   # copia el deploymentId de la versión activa (no @HEAD)
clasp update-deployment <deploymentId> --description "descripción del cambio"
```

`update-deployment` mantiene la misma URL `/exec` (la que ya está en `js/config.js`) — es lo que
se ha usado en todas las actualizaciones de este proyecto. Solo usar `clasp create-deployment`
(sin `update-`) si deliberadamente quieres una URL nueva; en ese caso hay que actualizar también
`js/config.js`.
