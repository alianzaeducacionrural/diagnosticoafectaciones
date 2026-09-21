// ================================================
// CONFIGURACIÓN — URL del backend en Google Apps Script
// ================================================
const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbyNsPIN3vvgG2oGL4Oa8SEmzMjKZEIAYJ042XyhBQVO6rJHRClB89IQGrZFw0I0YQyXrw/exec',

  // Trozos de 8 MiB para la subida reanudable a Drive (múltiplo de 256 KiB, como exige la API).
  TAMANO_TROZO: 8 * 1024 * 1024,

  // Compresión de fotos en el navegador antes de subirlas.
  FOTO_LADO_MAX: 1920,
  FOTO_CALIDAD: 0.82,
};

// Opciones de "Retorno a clases" — compartidas por retorno.html y el panel.
// `valor` es lo que se guarda en el Sheet (debe coincidir con RETORNO_OPCIONES
// de gas/Code.gs); `clave` es el sufijo de los tokens CSS --retorno-<clave>.
const RETORNO_OPCIONES = [
  { valor: 'Continúa el servicio', clave: 'continua' },
  { valor: 'Regreso condicionado', clave: 'condicionado' },
  { valor: 'Alternancia', clave: 'alternancia' },
  { valor: 'Trabajo pedagógico desde casa', clave: 'casa' },
  { valor: 'Regreso total a la presencialidad', clave: 'total' },
  { valor: 'Servicio temporalmente suspendido', clave: 'suspendido' },
];
