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
