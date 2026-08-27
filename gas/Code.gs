/**
 * ============================================================
 * Encuesta de Daños por Sismo — Instituciones Educativas de Caldas
 * Backend Google Apps Script (standalone, no vinculado a un Sheet)
 * ============================================================
 * Desplegar como Web App:
 *   Implementar → Nueva implementación → Aplicación web
 *   Ejecutar como: Yo (tu cuenta de Google)
 *   Quién tiene acceso: Cualquier usuario
 * Copiar la URL /exec resultante a js/config.js como GAS_URL.
 *
 * Antes de usar el formulario, ejecutar UNA vez inicializar()
 * desde este editor (menú de funciones → inicializar → Ejecutar).
 * Ver SETUP.md para el paso a paso completo.
 * ============================================================
 */

// ─── Configuración ──────────────────────────────────────────

// Carpeta "Encuesta de daños por sismo" en Drive — destino de todas las evidencias.
var DRIVE_ROOT_ID = '1gnAgwNEG_8TB69Jf1BFMyD9O9LGCjzoN';

// Origen del frontend publicado (GitHub Pages) — ver nota en sesionSubida_.
var FRONTEND_ORIGIN = 'https://alianzaeducacionrural.github.io';

// Spreadsheet externo "Simat 2025" (matrícula por sede, no lo crea este
// proyecto) — fuente de Matrícula y del código DANE de sede. Ver
// leerSimat_ y camposDerivados_.
var SIMAT_SHEET_ID = '1FzTSL6CjO_WxNhrokDklapRVGlzpyG9XkEZHC3fHltg';

var HEADERS_REGISTROS = [
  'Marca temporal', 'Padrino', 'Correo padrino', 'Teléfono padrino',
  'Municipio', 'Institución',
  'Nombre rector', 'Correo rector', 'Teléfono rector',
  'Sede', 'Nivel de afectación', 'Descripción del daño',
  '# Fotos', '# Videos', '# Documentos', 'Carpeta de la sede', 'Evidencias (JSON)', 'Estado',
  // Columnas derivadas — se llenan solas en guardarSede_ (camposDerivados_),
  // cruzando por Municipio|Institución|Sede contra SIMAT_SHEET_ID y la
  // pestaña "Conectividad". "espacios afectados..." queda vacía a
  // propósito: sin fuente de datos todavía.
  'Matrícula', 'codigo identificacion ie', 'espacios afectados /salones/laboratorios/aula maxima. etc', 'Conectividad',
];

// Índices 1-based de columnas.
var COL = {
  PADRINO: 2, MUNICIPIO: 5, INSTITUCION: 6, SEDE: 10, DESCRIPCION: 12,
  EVIDENCIAS: 17, ESTADO: 18,
  MATRICULA: 19, DANE_SEDE: 20, ESPACIOS_AFECTADOS: 21, CONECTIVIDAD: 22,
};

// Spreadsheet dedicado de resultados — ya creado a mano dentro de la carpeta
// de evidencias en Drive (no lo crea el script, para no depender del permiso
// de creación en el primer arranque).
var RESULTS_SHEET_ID = '1u7P_zM9iZMSTxisU_Ng0FdyHWWnwpSrRjSYLvjP-bKI';

// Semilla para poblar la pestaña "padrinos" (inicializar() y resembrarCatalogos_()).
// Lista oficial dada por el usuario el 2026-08-13. Federico y Jonathan aún no
// tienen correo — el formulario no lo exige para ellos (ver validarFormulario
// en js/form.js).
var PADRINOS_SEED = [["Alejandro Osorio Loaiza","edurural.osorio.alejandro@gmail.com","3242117624"],["Alexander de Jesús Ossa Calvo","edurural.ossa.alex@gmail.com","3113098982"],["Anderson González Gutiérrez","edurural.gonzalez.anderson@gmail.com","3137859779"],["Claudia Patricia Herrera Tellez","edurural.herrera.claudiap@gmail.com","3234229155"],["Cristian Hely Florez Rodríguez","edurural.florez.cristian@gmail.com","3113353986"],["David Steven Betancourth Gaitán","edurural.gaitan.david@gmail.com","3128540055"],["Jhon Jairo Franco Arenas","edurural.franco.jjairo@gmail.com","3104135372"],["Juan Gabriel Alzate Gallego","edurural.alzate.juang@gmail.com","3105454141"],["Juan Pablo Bedoya Cañon","edurural.bedoya.juan@gmail.com","3212306469"],["Libardo Andrés Acosta Hurtado","edurural.acosta.libardo@gmail.com","3146530530"],["Lucelly Giraldo Sierra","edurural.giraldo.lucelly@gmail.com","3117466108"],["Luis Gabriel Suárez Giraldo","edurural.suarez.lgabriel@gmail.com","3136617862"],["Santiago Ramírez García","edurural.ramirez.santiago@gmail.com","3112602704"],["Yeison Suárez Suárez","edurural.suarez.yeison@gmail.com","3148601125"],["Yohan Sebastián Molano Muñoz","edurural.molano.sebastian@gmail.com","3114791814"],["Julian Nieto Soto","edurural.nieto.julian@gmail.com","3146711874"],["Federico Castillón Salazar","",""],["Jonathan Gerardo Orozco Herrera","",""]];

// Semilla para poblar la pestaña "asignacion" (inicializar() y resembrarCatalogos_()).
// Tomado de Asignación.xlsx. "Marulanda" aparece dos veces (dos padrinos) a propósito.
var ASIGNACION_SEED = [["Aguadas","Julian Nieto Soto"],["Anserma","Juan Gabriel Alzate Gallego"],["Aranzazu","Lucelly Giraldo Sierra"],["Belalcázar","Jonathan Gerardo Orozco Herrera"],["Chinchiná","Jhon Jairo Franco Arenas"],["Filadelfia","Luis Gabriel Suárez Giraldo"],["La Dorada","Juan Pablo Bedoya Cañon"],["La Merced","Federico Castillón Salazar"],["Manzanares","Santiago Ramírez García"],["Marmato","Alexander de Jesús Ossa Calvo"],["Marquetalia","Santiago Ramírez García"],["Marulanda","Cristian Hely Florez Rodríguez"],["Marulanda","Julian Nieto Soto"],["Neira","Luis Gabriel Suárez Giraldo"],["Norcasia","Juan Pablo Bedoya Cañon"],["Pácora","Julian Nieto Soto"],["Palestina","Federico Castillón Salazar"],["Pensilvania","Cristian Hely Florez Rodríguez"],["Riosucio","Alejandro Osorio Loaiza"],["Risaralda","Libardo Andrés Acosta Hurtado"],["Salamina","Lucelly Giraldo Sierra"],["Samaná","Yohan Sebastián Molano Muñoz"],["San José","Juan Gabriel Alzate Gallego"],["Supía","Santiago Ramírez García"],["Victoria","Juan Pablo Bedoya Cañon"],["Villamaría","Jonathan Gerardo Orozco Herrera"],["Viterbo","Juan Gabriel Alzate Gallego"]];

// Clave simple para proteger el resembrado de catálogos — no es autenticación
// real (el resto del backend tampoco la tiene), solo evita que alguien active
// el endpoint por accidente o adivinando la URL.
var ADMIN_KEY = 'sismo-caldas-2026';

// Catálogo fijo Municipio/Institución/Sede — 26 municipios de Caldas, excluye
// Manizales y La Pintada. Tomado de la pestaña "Mun/IE/Sedes" del sheet maestro
// "Bases de datos Educación" el 2026-08-13. Si cambian las sedes, actualizar aquí.
var MUN_IE_SEDE = [["Aguadas","El Edén","Alto De La Montaña"],["Aguadas","El Edén","Alto Del Carmelo"],["Aguadas","El Edén","Antonio Gómez Estrada"],["Aguadas","El Edén","Central"],["Aguadas","El Edén","La Prosperidad"],["Aguadas","El Edén","La Zulia"],["Aguadas","El Edén","Leticia"],["Aguadas","El Edén","Matecaña"],["Aguadas","El Edén","Pito"],["Aguadas","El Edén","Pore"],["Aguadas","El Edén","San Antonio"],["Aguadas","El Edén","San Nicolas"],["Aguadas","Encimadas","Arenillal"],["Aguadas","Encimadas","Central"],["Aguadas","Encimadas","Los Naranjos"],["Aguadas","Encimadas","Miraflores"],["Aguadas","Encimadas","Puente Piedra"],["Aguadas","Encimadas","Santa Rosa"],["Aguadas","Encimadas","Siete Cueros"],["Aguadas","La Mermita","Cañaveral"],["Aguadas","La Mermita","Central"],["Aguadas","La Mermita","El Diamante"],["Aguadas","La Mermita","El Llano"],["Aguadas","La Mermita","El Pomo"],["Aguadas","La Mermita","Guaco"],["Aguadas","La Mermita","Guaimaral"],["Aguadas","La Mermita","La Rueda"],["Aguadas","La Mermita","Malabrigo"],["Aguadas","La Mermita","Monterredondo"],["Aguadas","La Mermita","Pisamal"],["Aguadas","La Mermita","San Martín"],["Aguadas","Rioarriba","Alto Bonito"],["Aguadas","Rioarriba","Central"],["Aguadas","Rioarriba","Culebral"],["Aguadas","Rioarriba","El Cedral"],["Aguadas","Rioarriba","El Limón"],["Aguadas","Rioarriba","La Chorrera"],["Aguadas","Rioarriba","Mesones"],["Aguadas","Rioarriba","Nudillales"],["Aguadas","Rioarriba","Tamboral"],["Aguadas","San Antonio de Arma","Ángel De La Guarda"],["Aguadas","San Antonio de Arma","Caciquillo"],["Aguadas","San Antonio de Arma","Central"],["Aguadas","San Antonio de Arma","Dos Quebradas"],["Aguadas","San Antonio de Arma","La Lorena"],["Aguadas","San Antonio de Arma","La María"],["Aguadas","San Antonio de Arma","Salineros"],["Aguadas","San Antonio de Arma","Tierra Fría"],["Aguadas","Viboral","Central"],["Aguadas","Viboral","Colorados"],["Aguadas","Viboral","La Blanquita"],["Aguadas","Viboral","La Castrillona"],["Aguadas","Viboral","Peñoles"],["Aguadas","Viboral","San Pablo"],["Aguadas","Viboral","Viboral"],["Anserma","Alto Nubia","Central"],["Anserma","Alto Nubia","La Cabaña"],["Anserma","Alto Nubia","La Esmeralda"],["Anserma","Alto Nubia","La Laguna"],["Anserma","Alto Nubia","Pedro Sarmiento"],["Anserma","Alto Nubia","Suer De Navas"],["Anserma","El Horro","Anzea"],["Anserma","El Horro","Central"],["Anserma","El Horro","Chapata"],["Anserma","El Horro","El Paraiso"],["Anserma","El Horro","General Santander"],["Anserma","El Horro","La Arboleda"],["Anserma","El Horro","Soria"],["Anserma","El Horro","Villa Orozco"],["Anserma","Gómez Fernandez","Central"],["Anserma","Gómez Fernandez","El Carmelo"],["Anserma","Gómez Fernandez","El Poblado"],["Anserma","Gómez Fernandez","Francisco De Frías"],["Anserma","Gómez Fernandez","Joséfa Becerra"],["Anserma","Gómez Fernandez","Martín De Amoroto"],["Anserma","Gómez Fernandez","Vergel Alto"],["Anserma","Gómez Fernandez","Villa Del Carmen"],["Anserma","Jerónimo de Tejelo","Central"],["Anserma","Jerónimo de Tejelo","Cristobal Colón"],["Anserma","Jerónimo de Tejelo","Diego De Mendoza"],["Anserma","Jerónimo de Tejelo","Las Mercedes"],["Anserma","Jerónimo de Tejelo","Morro Azul"],["Anserma","Jerónimo de Tejelo","San Luis"],["Anserma","Juan XXIII","Antonio Nariño"],["Anserma","Juan XXIII","Antonio Pimentel"],["Anserma","Juan XXIII","Central"],["Anserma","Juan XXIII","El Limón"],["Anserma","Juan XXIII","La Floresta"],["Anserma","Juan XXIII","Pedro Cieza De León"],["Anserma","Juan XXIII","Ruy Vanegas"],["Anserma","Juan XXIII","Taudia Bajo"],["Anserma","Ocuzca","Aconchara"],["Anserma","Ocuzca","Aguabonita"],["Anserma","Ocuzca","Álvaro De Mendoza"],["Anserma","Ocuzca","Andrés Mercado"],["Anserma","Ocuzca","Antonia Santos"],["Anserma","Ocuzca","Campoalegre"],["Anserma","Ocuzca","Central"],["Anserma","Ocuzca","Chavarquía"],["Anserma","Ocuzca","Juan Bautista Sardella"],["Anserma","Ocuzca","La Magdalena"],["Anserma","Ocuzca","La Tolda"],["Anserma","Ocuzca","Tabla Roja"],["Anserma","San Pedro","Bajo Vergel"],["Anserma","San Pedro","Central"],["Anserma","San Pedro","El Recreo"],["Anserma","San Pedro","El Rosario"],["Anserma","San Pedro","José María Cordoba"],["Anserma","San Pedro","La Linda"],["Aranzazu","Alegrías","Central"],["Aranzazu","Alegrías","Chambery"],["Aranzazu","Alegrías","Cuatro Esquinas"],["Aranzazu","Alegrías","El Roblal"],["Aranzazu","Alegrías","La Esperanza"],["Aranzazu","Alegrías","La Guaira"],["Aranzazu","Alegrías","San Ignacio"],["Aranzazu","Juan Crisóstomo Osorio","Antonia Santos"],["Aranzazu","Juan Crisóstomo Osorio","Buenos Aires"],["Aranzazu","Juan Crisóstomo Osorio","Camelia Baja"],["Aranzazu","Juan Crisóstomo Osorio","Campo Alegre"],["Aranzazu","Juan Crisóstomo Osorio","Central"],["Aranzazu","Juan Crisóstomo Osorio","Divino Niño"],["Aranzazu","Juan Crisóstomo Osorio","El Rocio"],["Aranzazu","Juan Crisóstomo Osorio","La Floresta"],["Aranzazu","Juan Crisóstomo Osorio","Pío XII"],["Aranzazu","Juan Crisóstomo Osorio","Santa Cecilia"],["Aranzazu","Juan Crisóstomo Osorio","Santacruz"],["Aranzazu","Pío XI","Central"],["Aranzazu","Pío XI","Diamante Bajo"],["Aranzazu","Pío XI","El Jardín"],["Aranzazu","Pío XI","Eladia Mejía"],["Aranzazu","Pío XI","Manuel Gutiérrez Robledo"],["Aranzazu","Pío XI","Manuela Beltrán"],["Aranzazu","Pío XI","Palmichal"],["Aranzazu","Pío XI","Puerto Samaria"],["Aranzazu","Pío XI","San Antonio"],["Aranzazu","Pío XI","San Miguel"],["Belalcázar","El Águila","Alto Bonito"],["Belalcázar","El Águila","Central"],["Belalcázar","El Águila","La Betulia"],["Belalcázar","El Águila","La Cascada"],["Belalcázar","El Águila","La Elvira"],["Belalcázar","El Águila","La Zainera"],["Belalcázar","El Águila","Simón Bolívar"],["Belalcázar","El Madroño","Central"],["Belalcázar","El Madroño","Conventos"],["Belalcázar","El Madroño","El Carmen"],["Belalcázar","El Madroño","Las Palomas"],["Belalcázar","El Madroño","Portugal"],["Belalcázar","El Madroño","San Narcizo"],["Belalcázar","El Madroño","Tierradentro"],["Belalcázar","El Madroño","Verdun"],["Belalcázar","San Isidro","Buenavista"],["Belalcázar","San Isidro","Central"],["Belalcázar","San Isidro","El Crucero"],["Belalcázar","San Isidro","El Socorro"],["Belalcázar","San Isidro","La Florida"],["Belalcázar","San Isidro","La Habana"],["Belalcázar","San Isidro","La Romelia"],["Belalcázar","San Isidro","Las Delicias"],["Belalcázar","San Isidro","Monterredondo"],["Belalcázar","San Isidro","San Isidro"],["Belalcázar","San Isidro","San Luis"],["Chinchiná","Eduardo Gómez Arrubla","Alto Chuscal"],["Chinchiná","Eduardo Gómez Arrubla","Central"],["Chinchiná","Eduardo Gómez Arrubla","La Pradera"],["Chinchiná","Eduardo Gómez Arrubla","San Andrés"],["Chinchiná","El Trébol","Bajo Español"],["Chinchiná","El Trébol","Central"],["Chinchiná","El Trébol","El Trébol"],["Chinchiná","El Trébol","Gabriela Mistral"],["Chinchiná","El Trébol","José María Cordoba"],["Chinchiná","El Trébol","Marco Fidel Suárez"],["Chinchiná","El Trébol","San Francisco"],["Chinchiná","El Trébol","Santa Helena"],["Chinchiná","Naranjal","Altamira"],["Chinchiná","Naranjal","Antonio Nariño"],["Chinchiná","Naranjal","Central"],["Chinchiná","Naranjal","Crucetas"],["Chinchiná","Naranjal","El Reposo"],["Chinchiná","Naranjal","Manuela Beltrán"],["Chinchiná","Naranjal","San Luis"],["Chinchiná","Naranjal","San Martín De Porres"],["Chinchiná","Naranjal","Simón Bolívar"],["Filadelfia","Antonio Nariño","Aguadita Grande"],["Filadelfia","Antonio Nariño","Aguadita Pequeña"],["Filadelfia","Antonio Nariño","Atanasio Girardoth"],["Filadelfia","Antonio Nariño","Central"],["Filadelfia","Antonio Nariño","El Pintado"],["Filadelfia","Antonio Nariño","Eladia Mejía"],["Filadelfia","Antonio Nariño","La Amapola"],["Filadelfia","Antonio Nariño","La Ceiba"],["Filadelfia","Antonio Nariño","La Dorada"],["Filadelfia","Antonio Nariño","La MARÍNa"],["Filadelfia","Antonio Nariño","La Palma"],["Filadelfia","Antonio Nariño","La Soledad"],["Filadelfia","Antonio Nariño","Manuelita Sáenz"],["Filadelfia","Antonio Nariño","Piedras Blancas"],["Filadelfia","Antonio Nariño","San Cayetano"],["Filadelfia","Crisanto Luque","Alto Maibá"],["Filadelfia","Crisanto Luque","Altomira"],["Filadelfia","Crisanto Luque","Balmoral"],["Filadelfia","Crisanto Luque","Central"],["Filadelfia","Crisanto Luque","El Castillo"],["Filadelfia","Crisanto Luque","La Gran Colombia"],["Filadelfia","Crisanto Luque","La Ilusión"],["Filadelfia","Crisanto Luque","La India"],["Filadelfia","Crisanto Luque","María Goretti"],["Filadelfia","Crisanto Luque","Policarpa Salavarrieta"],["Filadelfia","Crisanto Luque","Sagrado Corazón de Jesús"],["Filadelfia","Crisanto Luque","San Luis"],["Filadelfia","Crisanto Luque","Santa Ana"],["Filadelfia","Crisanto Luque","Santa Rita"],["Filadelfia","Crisanto Luque","Simón Bolívar"],["Filadelfia","Filadelfia","Central"],["Filadelfia","Filadelfia","General Santander"],["Filadelfia","Filadelfia","María Inmaculada"],["La Dorada","Buenavista","Central"],["La Dorada","Buenavista","Juan José Cadavid"],["La Dorada","Buenavista","La Habana"],["La Dorada","Buenavista","San Fernando"],["La Dorada","El Japón","Central"],["La Dorada","El Japón","La Agustina"],["La Dorada","Guarinocito","Central"],["La Dorada","Guarinocito","El Horizonte"],["La Dorada","Guarinocito","Francisco José de Caldas"],["La Dorada","Purnio","Central"],["La Merced","La Felisa","Central"],["La Merced","La Felisa","El Tambor"],["La Merced","Llanadas","Central"],["La Merced","Llanadas","El Limón"],["La Merced","Llanadas","El Yarumo"],["La Merced","Llanadas","La Quiebra de San Isidro"],["La Merced","Llanadas","Peña Rica"],["La Merced","Llanadas","San José"],["La Merced","Llanadas","Satélite Fontibón"],["La Merced","Llanadas","Maciegal"],["Manzanares","Aguabonita","Central"],["Manzanares","Aguabonita","El Crucero"],["Manzanares","Aguabonita","Guayaquil"],["Manzanares","Aguabonita","La Cristalina"],["Manzanares","Aguabonita","La Gallera"],["Manzanares","Aguabonita","La Sonrisa"],["Manzanares","Aguabonita","San Vicente"],["Manzanares","Gregorio Gutiérrez González","Central"],["Manzanares","Gregorio Gutiérrez González","El Vergel"],["Manzanares","Gregorio Gutiérrez González","La Rica"],["Manzanares","Gregorio Gutiérrez González","Las Peñas"],["Manzanares","Gregorio Gutiérrez González","Sagrado Corazón"],["Manzanares","Gregorio Gutiérrez González","San José"],["Manzanares","Gregorio Gutiérrez González","San Juan Guarinó"],["Manzanares","Gregorio Gutiérrez González","San Juan La Siria"],["Manzanares","Gregorio Gutiérrez González","Santa Barbara"],["Manzanares","Gregorio Gutiérrez González","Santa Barbara Alta"],["Manzanares","José Antonio Galán","Buenos Aires"],["Manzanares","José Antonio Galán","Central"],["Manzanares","José Antonio Galán","José Joaquín Montes Giraldo"],["Manzanares","José Antonio Galán","La Arabia"],["Manzanares","José Antonio Galán","La Italia"],["Manzanares","José Antonio Galán","Las Mercedes"],["Manzanares","José Antonio Galán","Santo Domingo"],["Manzanares","Llanadas","Ana Arango De Uribe"],["Manzanares","Llanadas","Ana Julia Vargas de Arango"],["Manzanares","Llanadas","Campoalegre"],["Manzanares","Llanadas","Central"],["Manzanares","Llanadas","Corozal"],["Manzanares","Llanadas","Dosquebradas"],["Manzanares","Llanadas","La Ceiba"],["Manzanares","Llanadas","La Esmeralda"],["Manzanares","Llanadas","Los Fundadores"],["Manzanares","Llanadas","Palmichal"],["Manzanares","Manzanares","Santa Clara"],["Manzanares","Romeral","Central"],["Manzanares","Romeral","El Castillo"],["Manzanares","Romeral","La Miel"],["Manzanares","Romeral","La Unión"],["Manzanares","Romeral","Quebraditas"],["Marmato","Cabras","Central"],["Marmato","Cabras","Conchari"],["Marmato","Cabras","Guadualejo"],["Marmato","Cabras","La Loma"],["Marmato","Cabras","La Portada"],["Marmato","El Llano","Central"],["Marmato","General Ramón Marín","Central"],["Marmato","General Ramón Marín","José Antonio Galán"],["Marmato","Marmato","Bellavista"],["Marmato","Marmato","Echandia"],["Marmato","Marmato","Jimenez"],["Marmato","Rafael Pombo","Central"],["Marmato","Rafael Pombo","El Vergel"],["Marmato","Rafael Pombo","La Miel"],["Marquetalia","Antonio María Hincapié","Central"],["Marquetalia","Antonio María Hincapié","El Palmar"],["Marquetalia","Antonio María Hincapié","El Retiro"],["Marquetalia","Antonio María Hincapié","El Rosario"],["Marquetalia","Antonio María Hincapié","El Vergel"],["Marquetalia","Antonio María Hincapié","Gancho"],["Marquetalia","Antonio María Hincapié","Guacas"],["Marquetalia","Antonio María Hincapié","Guarinó Guamo"],["Marquetalia","Antonio María Hincapié","La Moscovita"],["Marquetalia","Antonio María Hincapié","San Pablo"],["Marquetalia","Antonio María Hincapié","San Roque"],["Marquetalia","Antonio María Hincapié","Santa Elena"],["Marquetalia","El Placer","Buenos Aires"],["Marquetalia","El Placer","Central"],["Marquetalia","El Placer","El Aguacate"],["Marquetalia","El Placer","El Choco"],["Marquetalia","El Placer","El Porvenir"],["Marquetalia","El Placer","La Esmeralda"],["Marquetalia","El Placer","La Miel"],["Marquetalia","El Placer","San Luis"],["Marquetalia","El Placer","Unión Baja"],["Marquetalia","La Quiebra","Alegrías"],["Marquetalia","La Quiebra","Campoalegre"],["Marquetalia","La Quiebra","Central"],["Marquetalia","La Quiebra","La Bamba"],["Marquetalia","La Quiebra","La Florida - Central"],["Marquetalia","La Quiebra","La Palma"],["Marquetalia","La Quiebra","La Unión Alta"],["Marquetalia","La Quiebra","San Juan"],["Marquetalia","Patio Bonito","Cayetano"],["Marquetalia","Patio Bonito","Central"],["Marquetalia","Patio Bonito","Costa Rica"],["Marquetalia","Patio Bonito","La Parda"],["Marquetalia","Patio Bonito","La Playa"],["Marquetalia","Patio Bonito","Las Gaviotas"],["Marquetalia","Patio Bonito","Lituania"],["Marquetalia","Patio Bonito","San Gregorio"],["Marquetalia","Patio Bonito","Tebaida"],["Marulanda","Efrén Cardona Chica","Central"],["Marulanda","Efrén Cardona Chica","Espartillal"],["Marulanda","Efrén Cardona Chica","Herveo"],["Marulanda","Efrén Cardona Chica","La Alejandría"],["Marulanda","Efrén Cardona Chica","Los Sauces"],["Marulanda","Efrén Cardona Chica","San Isidro"],["Marulanda","Efrén Cardona Chica","San Pablo"],["Marulanda","Efrén Cardona Chica","Simón Bolívar"],["Marulanda","Montebonito","Central"],["Marulanda","Montebonito","Mercedes Abrego"],["Marulanda","Montebonito","Santa Clara"],["Neira","Aguacatal","Antonia Santos"],["Neira","Aguacatal","Central"],["Neira","Aguacatal","Divino Niño"],["Neira","Aguacatal","Francisco José de Caldas"],["Neira","Aguacatal","José Acevedo y Gómez"],["Neira","Aguacatal","María Auxiliadora"],["Neira","Aguacatal","Sagrado Corazón de Jesús"],["Neira","El Roble","Central"],["Neira","El Roble","Juan José Neira"],["Neira","El Roble","Miguel Ángel Villegas"],["Neira","El Roble","Rafael Reyes"],["Neira","El Roble","San Luis Gonzaga"],["Neira","El Roble","San Pablo"],["Neira","El Roble","Santa Elena"],["Neira","Llanogrande","Antonio Ricaute"],["Neira","Llanogrande","Camilo Torres"],["Neira","Llanogrande","Central"],["Neira","Llanogrande","Francisco de Paula Santander"],["Neira","Llanogrande","Gabriela Mistral"],["Neira","Llanogrande","Jhon Kennedy"],["Neira","Llanogrande","José María Carbonell"],["Neira","Llanogrande","Juan Pablo I"],["Neira","Llanogrande","La Asunción"],["Neira","Llanogrande","Manuela Beltrán"],["Neira","Llanogrande","María Magdalena"],["Neira","Llanogrande","San Juan Bautista"],["Neira","Pío XII","Central"],["Neira","Pío XII","Jesús Antonio Cardona"],["Neira","Pío XII","Marco Fidel Suárez"],["Neira","Pío XII","Mercedes Abrego"],["Neira","Pío XII","Santa Teresa De Jesús"],["Neira","Pío XII","Simón Bolívar"],["Neira","Pueblo Rico","Central"],["Neira","Pueblo Rico","Emigdio Marín"],["Neira","Pueblo Rico","Juan XXIII"],["Neira","Pueblo Rico","Las Américas"],["Neira","Pueblo Rico","Pablo VI"],["Neira","Pueblo Rico","Santa Cecilia"],["Neira","Pueblo Rico","Santa Inés"],["Neira","San Luis","Antonio José de Sucre"],["Neira","San Luis","Central"],["Neira","San Luis","El Vaticano"],["Neira","San Luis","Policarpa Salavarrieta"],["Neira","San Luis","San José"],["Norcasia","La Estrella","Bajo Jagual"],["Norcasia","La Estrella","Cardenales"],["Norcasia","La Estrella","Central"],["Norcasia","La Estrella","El Jagual"],["Norcasia","La Estrella","Kilómetro 40"],["Norcasia","La Estrella","La Estrella"],["Norcasia","La Estrella","Las Delicias"],["Norcasia","La Estrella","Los Ceibos"],["Norcasia","La Estrella","Montebello"],["Norcasia","La Estrella","Moscovita"],["Norcasia","La Estrella","Planes Mirador"],["Norcasia","La Estrella","Quiebra de Roque"],["Norcasia","La Estrella","San Esteban"],["Norcasia","La Estrella","Santa María"],["Pácora","Francisco José de Caldas","Arrieta"],["Pácora","Francisco José de Caldas","Central"],["Pácora","Francisco José de Caldas","El Escobal"],["Pácora","Francisco José de Caldas","Estacion Pácora"],["Pácora","Francisco José de Caldas","Miraflores"],["Pácora","Francisco José de Caldas","San Francisco"],["Pácora","La Milagrosa","Campo Alegre"],["Pácora","La Milagrosa","Central"],["Pácora","La Milagrosa","El Cedral"],["Pácora","La Milagrosa","El Topacio"],["Pácora","La Milagrosa","Filobonito"],["Pácora","La Milagrosa","Los Morros"],["Pácora","La Milagrosa","Palma Alta"],["Pácora","La Milagrosa","Palma Baja"],["Pácora","La Milagrosa","Payande"],["Pácora","Las Coles","Central"],["Pácora","Las Coles","El Castillo"],["Pácora","Las Coles","Ginebra"],["Pácora","Las Coles","La Albania"],["Pácora","Las Coles","Las Trojes"],["Pácora","Las Coles","Loma Hermosa"],["Pácora","Las Coles","Los Medios"],["Pácora","Las Coles","Maracas"],["Pácora","Las Coles","Mata De Guadua"],["Pácora","Las Coles","San Lorencito"],["Pácora","Las Coles","Vendigujal"],["Pácora","Mariscal Robledo","Central"],["Pácora","Mariscal Robledo","Jorge Robledo"],["Pácora","Mariscal Robledo","San Juan Bosco"],["Pácora","Mariscal Robledo","Santa Teresita"],["Palestina","Cartagena","Central"],["Palestina","Cartagena","El Salado"],["Palestina","Cartagena","La Inquisición"],["Palestina","Cartagena","La Merced Alta"],["Palestina","José María Carbonell","Central"],["Palestina","José María Carbonell","El Higuerón"],["Palestina","José María Carbonell","El Reposo"],["Palestina","José María Carbonell","La Plata"],["Palestina","José María Carbonell","Los Lobos"],["Palestina","Santágueda","Central"],["Palestina","Santágueda","El Retiro"],["Palestina","Santágueda","Fátima"],["Pensilvania","Camilo Olimpo Cardona","Albania Alta"],["Pensilvania","Camilo Olimpo Cardona","Albania Baja"],["Pensilvania","Camilo Olimpo Cardona","Antonio Ricaurte"],["Pensilvania","Camilo Olimpo Cardona","Central"],["Pensilvania","Camilo Olimpo Cardona","El Higuerón"],["Pensilvania","Camilo Olimpo Cardona","El Jardín"],["Pensilvania","Camilo Olimpo Cardona","La Asunción"],["Pensilvania","Camilo Olimpo Cardona","La Bamba"],["Pensilvania","Camilo Olimpo Cardona","La Mesa"],["Pensilvania","Camilo Olimpo Cardona","Soledad Alta"],["Pensilvania","Daniel María López Rodríguez","Aurora Baja"],["Pensilvania","Daniel María López Rodríguez","Central"],["Pensilvania","Daniel María López Rodríguez","Chaquiral"],["Pensilvania","Daniel María López Rodríguez","El Naranjito"],["Pensilvania","Daniel María López Rodríguez","El Naranjo"],["Pensilvania","Daniel María López Rodríguez","La Florida"],["Pensilvania","Daniel María López Rodríguez","Las Pavas"],["Pensilvania","Daniel María López Rodríguez","Palogrande"],["Pensilvania","Daniel María López Rodríguez","Policarpa Salabarrieta"],["Pensilvania","Daniel María López Rodríguez","Santo Domingo"],["Pensilvania","Daniel María López Rodríguez","Sebastopol"],["Pensilvania","Daniel María López Rodríguez","Villaraz Alto"],["Pensilvania","Daniel María López Rodríguez","Villaraz Bajo"],["Pensilvania","Francisco Julian Olaya","Central"],["Pensilvania","Francisco Julian Olaya","Guayaquil"],["Pensilvania","Francisco Julian Olaya","La Ceiba"],["Pensilvania","Francisco Julian Olaya","Las Mercedes"],["Pensilvania","Francisco Julian Olaya","María Nubiola Ortiz"],["Pensilvania","Francisco Julian Olaya","Miraflores"],["Pensilvania","Francisco Julian Olaya","Playa Rica"],["Pensilvania","Guacas","Alto Anime"],["Pensilvania","Guacas","Arenillal"],["Pensilvania","Guacas","Buenos Aires Alto"],["Pensilvania","Guacas","Cartagena"],["Pensilvania","Guacas","Central"],["Pensilvania","Guacas","El Castillo"],["Pensilvania","Guacas","El Líbano"],["Pensilvania","Guacas","La Cascada"],["Pensilvania","Guacas","La Florida"],["Pensilvania","Guacas","La Palmera Baja"],["Pensilvania","Guacas","Las Colonias"],["Pensilvania","Guacas","Las Palomas"],["Pensilvania","Guacas","Los Medios"],["Pensilvania","Guacas","Quebrada Negra"],["Pensilvania","Guacas","Santa Teresita"],["Pensilvania","John F. Kennedy","Central"],["Pensilvania","John F. Kennedy","La Costa"],["Pensilvania","John F. Kennedy","La Primavera"],["Pensilvania","John F. Kennedy","Las Brisas"],["Pensilvania","John F. Kennedy","Las Playas"],["Pensilvania","John F. Kennedy","Manuela Beltrán"],["Pensilvania","John F. Kennedy","Patio Bonito"],["Pensilvania","John F. Kennedy","Tulio Ramírez"],["Pensilvania","La Rioja","Armenia"],["Pensilvania","La Rioja","Central"],["Pensilvania","La Rioja","El Cricerio"],["Pensilvania","La Rioja","La Esperanza"],["Pensilvania","La Rioja","Las Estrella"],["Pensilvania","La Rioja","Morrón"],["Pensilvania","La Rioja","San Miguel"],["Pensilvania","La Rioja","San Pablo"],["Pensilvania","Pablo VI","Bajo Verdal"],["Pensilvania","Pablo VI","Campo Alegre"],["Pensilvania","Pablo VI","Central"],["Pensilvania","Pablo VI","El Recreo"],["Pensilvania","Pablo VI","El Sandal"],["Pensilvania","Pablo VI","La Cruz"],["Pensilvania","Pablo VI","La Loma"],["Pensilvania","Pablo VI","La Mina"],["Pensilvania","Pablo VI","La Torre"],["Pensilvania","Pablo VI","Samaria"],["Pensilvania","Pablo VI","Verdal Alto"],["Pensilvania","Santa Rita","Central"],["Pensilvania","Santa Rita","La Marina"],["Pensilvania","Santa Rita","Los Medios"],["Pensilvania","Santa Rita","Los Pomos"],["Pensilvania","Santa Rita","María Tenerife"],["Pensilvania","Santa Rita","Misael Pastrana Borrero"],["Pensilvania","Santa Rita","Santa Ana"],["Riosucio","Florencia","Agua Bonita"],["Riosucio","Florencia","Alto Bonito"],["Riosucio","Florencia","Central"],["Riosucio","Florencia","El Carmelo"],["Riosucio","Florencia","Juan Bautista Betancur"],["Riosucio","Florencia","Los Ángeles Jaguero"],["Riosucio","Florencia","Mejíal"],["Riosucio","Florencia","Trujillo"],["Riosucio","Nuestra Señora de Fátima","Barranquilla"],["Riosucio","Nuestra Señora de Fátima","Central"],["Riosucio","Nuestra Señora de Fátima","La Cabaña"],["Riosucio","Nuestra Señora de Fátima","Las Minas"],["Riosucio","Nuestra Señora de Fátima","Samaria"],["Riosucio","Nuestra Señora de Fátima","Santa Cecilia"],["Riosucio","Nuestra Señora de Fátima","Travesias"],["Risaralda","Francisco José de Caldas","Antonia Santos"],["Risaralda","Francisco José de Caldas","Antonio José de Sucre"],["Risaralda","Francisco José de Caldas","Central"],["Risaralda","Francisco José de Caldas","Divino Niño"],["Risaralda","Francisco José de Caldas","El Brillante"],["Risaralda","Francisco José de Caldas","General Santander"],["Risaralda","Francisco José de Caldas","La Trinidad"],["Risaralda","Francisco José de Caldas","Rafael Pombo"],["Risaralda","Francisco José de Caldas","Sagrado Corazón"],["Risaralda","Francisco José de Caldas","Santa Ana"],["Risaralda","Gabriel García Márquez","Central"],["Risaralda","Gabriel García Márquez","El Cairo"],["Risaralda","Gabriel García Márquez","Indígena Tamaniza"],["Risaralda","Gabriel García Márquez","La Bohemia"],["Risaralda","Gabriel García Márquez","La Esperanza"],["Risaralda","Gabriel García Márquez","La Miranda"],["Risaralda","Gabriel García Márquez","La Piel Roja"],["Risaralda","Gabriel García Márquez","Policarpa Salavarrieta"],["Risaralda","Gabriel García Márquez","Quiebra De Varillas"],["Risaralda","Quiebra de Santa Barbara","Alto Arauca"],["Risaralda","Quiebra de Santa Barbara","Central"],["Risaralda","Quiebra de Santa Barbara","La Esmeralda"],["Risaralda","Quiebra de Santa Barbara","La Patria"],["Risaralda","Quiebra de Santa Barbara","La Romelia"],["Risaralda","Quiebra de Santa Barbara","Santa Lucia"],["Salamina","El Perro","Álvaro Serna Botero"],["Salamina","El Perro","Amoladora Grande"],["Salamina","El Perro","Calentaderos"],["Salamina","El Perro","Central"],["Salamina","El Perro","El Carretero"],["Salamina","El Perro","Eladia Mejía - Central"],["Salamina","El Perro","En Medio de los Rios"],["Salamina","El Perro","La Albania"],["Salamina","El Perro","La Flora"],["Salamina","El Perro","La Loma"],["Salamina","El Perro","Las Delgaditas"],["Salamina","El Perro","Los Ángeles"],["Salamina","El Perro","Los Limónes"],["Salamina","El Perro","Los Mangos"],["Salamina","El Perro","San Diego"],["Salamina","Luis Felipe Gutiérrez Loaiza","Águila Grande"],["Salamina","Luis Felipe Gutiérrez Loaiza","Cañaveral"],["Salamina","Luis Felipe Gutiérrez Loaiza","Central"],["Salamina","Luis Felipe Gutiérrez Loaiza","Colorados"],["Salamina","Luis Felipe Gutiérrez Loaiza","El Cedrito"],["Salamina","Luis Felipe Gutiérrez Loaiza","La Arenosa"],["Salamina","Luis Felipe Gutiérrez Loaiza","La Divisa"],["Salamina","Luis Felipe Gutiérrez Loaiza","La Herradura"],["Salamina","Luis Felipe Gutiérrez Loaiza","La Palma"],["Salamina","Luis Felipe Gutiérrez Loaiza","La Quiebra"],["Salamina","Luis Felipe Gutiérrez Loaiza","La Selva"],["Salamina","Luis Felipe Gutiérrez Loaiza","Portachuelo"],["Salamina","San Félix","Cabuyal"],["Salamina","San Félix","Camilo Torres"],["Salamina","San Félix","Central"],["Salamina","San Félix","El Porvenir"],["Salamina","San Félix","San Luis"],["Samaná","Dulce Nombre","Central"],["Samaná","Dulce Nombre","Encimadas"],["Samaná","Dulce Nombre","Finca Nueva"],["Samaná","Dulce Nombre","La Tulia"],["Samaná","Dulce Nombre","Los Pomos"],["Samaná","Dulce Nombre","Montesory"],["Samaná","Dulce Nombre","Patio Bonito"],["Samaná","Dulce Nombre","Santa Bárbara"],["Samaná","Dulce Nombre","Santa Marta"],["Samaná","El Bosque","Central"],["Samaná","El Bosque","Congal"],["Samaná","El Bosque","Guayaquil"],["Samaná","El Bosque","La Cumbre"],["Samaná","El Bosque","Nueva Quebrada Seca"],["Samaná","El Bosque","San Lorenzo"],["Samaná","El Silencio","Antonio Nariño"],["Samaná","El Silencio","Central"],["Samaná","El Silencio","El Dorado"],["Samaná","El Silencio","El Jardín"],["Samaná","El Silencio","La Libertad"],["Samaná","El Silencio","La Vención"],["Samaná","El Silencio","Mercedes Abrego"],["Samaná","El Silencio","San Isidro"],["Samaná","El Silencio","Santa Rita"],["Samaná","El Silencio","Santa Teresita"],["Samaná","El Silencio","Villeta"],["Samaná","Encimadas","Central"],["Samaná","Encimadas","El Consuelo"],["Samaná","Encimadas","El Quindío"],["Samaná","Encimadas","Guacamayal"],["Samaná","Encimadas","La Aurora"],["Samaná","Encimadas","La Cristalina"],["Samaná","Encimadas","La Esmeralda"],["Samaná","Encimadas","La Manuelita"],["Samaná","Encimadas","La Sombra"],["Samaná","Encimadas","Montebello"],["Samaná","Encimadas","Pichínche"],["Samaná","Encimadas","Viboral"],["Samaná","Encimadas","Yarumalito"],["Samaná","Félix Naranjo","Argentina"],["Samaná","Félix Naranjo","Belén Alto"],["Samaná","Félix Naranjo","Central"],["Samaná","Félix Naranjo","El Castillo"],["Samaná","Félix Naranjo","Juan Pablo II"],["Samaná","Félix Naranjo","La Alejandría"],["Samaná","Félix Naranjo","La Guayana"],["Samaná","Félix Naranjo","La Linda"],["Samaná","Félix Naranjo","La Sonrisa"],["Samaná","Félix Naranjo","Pueblo Nuevo"],["Samaná","Félix Naranjo","Riachuelo Bajo"],["Samaná","Félix Naranjo","Tarro Pintado"],["Samaná","Pío XII","Bernardo Ocampo Herrera"],["Samaná","Pío XII","Buena Vista Baja"],["Samaná","Pío XII","Central"],["Samaná","Pío XII","El Porvenir"],["Samaná","Pío XII","Jardínes"],["Samaná","Pío XII","La Abundancia"],["Samaná","Pío XII","La Gallera"],["Samaná","Pío XII","La Reina"],["Samaná","Rancho Largo","Alejandro Gutiérrez"],["Samaná","Rancho Largo","Central"],["Samaná","Rancho Largo","Costa Rica Alta"],["Samaná","Rancho Largo","El Brasil"],["Samaná","Rancho Largo","El Castillo"],["Samaná","Rancho Largo","General Páez"],["Samaná","Rancho Largo","Guadualejo"],["Samaná","Rancho Largo","Isabel La Católica"],["Samaná","Rancho Largo","Jorge Isaac"],["Samaná","Rancho Largo","La Florida"],["Samaná","Rancho Largo","La Palma"],["Samaná","Rancho Largo","La Planta"],["Samaná","Rancho Largo","La Quiebra"],["Samaná","Rancho Largo","La Quinta"],["Samaná","Rancho Largo","Naranjal"],["Samaná","Rancho Largo","Pekín"],["Samaná","Rancho Largo","San Agustín"],["Samaná","Rancho Largo","Sasaima"],["Samaná","Rancho Largo","Segovia"],["Samaná","Rancho Largo","Tesoritos"],["San José","La Libertad","Alto Mira"],["San José","La Libertad","Arrayanes"],["San José","La Libertad","Buenavista"],["San José","La Libertad","Central"],["San José","La Libertad","El Bosque"],["San José","La Libertad","El Contento"],["San José","La Libertad","La Estrella"],["San José","La Libertad","La Paz"],["San José","La Libertad","Los Caimos"],["San José","La Libertad","Morro Azul"],["San José","La Libertad","Primavera Alta"],["San José","La Libertad","Tamaniza Alta"],["San José","La Libertad","Tamboral"],["Supía","Hojas Anchas","Antonio Nariño"],["Supía","Hojas Anchas","Bajo San Francisco"],["Supía","Hojas Anchas","Cabuyal"],["Supía","Hojas Anchas","Caracoli"],["Supía","Hojas Anchas","Central"],["Supía","Hojas Anchas","El Contento"],["Supía","Hojas Anchas","El Rodeo"],["Supía","Hojas Anchas","La Amalia"],["Supía","Hojas Anchas","La Argentina"],["Supía","Hojas Anchas","La Bodega"],["Supía","Hojas Anchas","La Divisa"],["Supía","Hojas Anchas","La Loma"],["Supía","Hojas Anchas","La Quinta"],["Supía","Hojas Anchas","La Torre"],["Supía","Hojas Anchas","María Pizarro"],["Supía","Hojas Anchas","Murillo"],["Supía","Hojas Anchas","San Joaquín"],["Supía","Obispo","Alto Obispo"],["Supía","Obispo","Buenavista"],["Supía","Obispo","Camacho"],["Supía","Obispo","Central"],["Supía","Obispo","El Descanso"],["Supía","Obispo","El Porvenir"],["Supía","Obispo","Guascal"],["Supía","Obispo","La Clara"],["Supía","Obispo","La Pava"],["Supía","Obispo","La Trina"],["Supía","Obispo","La Vega"],["Supía","Obispo","Matecaña"],["Supía","Obispo","Mudarra"],["Supía","Obispo","Palmasola"],["Supía","Supía","Central"],["Victoria","Cañaveral","Bellavista"],["Victoria","Cañaveral","Central"],["Victoria","Cañaveral","Corinto"],["Victoria","Cañaveral","Doña Juana Alta"],["Victoria","Cañaveral","Fierritos"],["Victoria","Cañaveral","La Italia"],["Victoria","Cañaveral","La Miel Alta"],["Victoria","Cañaveral","Marco Fidel Suárez"],["Victoria","Cañaveral","San Lorenzo"],["Victoria","Isaza","Carrizales"],["Victoria","Isaza","Central"],["Victoria","Isaza","La Fe"],["Victoria","Isaza","La Garrucha"],["Victoria","Isaza","La Guayana"],["Victoria","Isaza","La UNIÓN Cimitarra"],["Victoria","Isaza","Los Limónes"],["Victoria","Isaza","Vega Grande"],["Victoria","San Pablo","Antonio Nariño"],["Victoria","San Pablo","Central"],["Victoria","San Pablo","Doña Juana Baja"],["Victoria","San Pablo","El Llano"],["Victoria","San Pablo","Marzala"],["Victoria","San Pablo","Santa Cecilia"],["Victoria","San Pablo","Santa Isabel"],["Villamaría","Colombia","Alto El Castillo"],["Villamaría","Colombia","Antonio Nariño"],["Villamaría","Colombia","Central"],["Villamaría","Colombia","Londoño Jaramillo"],["Villamaría","Colombia","María Reina"],["Villamaría","Colombia","Santo Domingo"],["Villamaría","Colombia","Valles"],["Villamaría","Fortunato Gaviria Botero","Alto Villarazo"],["Villamaría","Fortunato Gaviria Botero","Bajo Corozal"],["Villamaría","Fortunato Gaviria Botero","Bajo Villarazo"],["Villamaría","Fortunato Gaviria Botero","Central"],["Villamaría","Fortunato Gaviria Botero","La Primavera"],["Villamaría","Fortunato Gaviria Botero","Miraflores"],["Villamaría","Fortunato Gaviria Botero","Rio Claro"],["Villamaría","Fortunato Gaviria Botero","Simón Bolívar"],["Villamaría","Fortunato Gaviria Botero","Trece De Mayo"],["Villamaría","Partidas","Central"],["Villamaría","Partidas","Pinares"],["Villamaría","Pío XII","Alto Arroyo"],["Villamaría","Pío XII","Bajo Castillo"],["Villamaría","Pío XII","Central"],["Villamaría","Pío XII","El Avión"],["Villamaría","Pío XII","La Milagrosa"],["Viterbo","El Socorro","Bellavista"],["Viterbo","El Socorro","Canaan"],["Viterbo","El Socorro","Central"],["Viterbo","El Socorro","Changui"],["Viterbo","El Socorro","El Palmar"],["Viterbo","El Socorro","El Porvenir"],["Viterbo","El Socorro","La Arabia"],["Viterbo","El Socorro","La María"],["Viterbo","El Socorro","La Tesalia"]];

// ─── Router HTTP ────────────────────────────────────────────

function doGet(e) {
  try {
    var accion = (e && e.parameter && e.parameter.accion) || '';
    if (accion === 'catalogos') return jsonResponse(getCatalogos_());
    if (accion === 'misRegistros') return jsonResponse(misRegistros_((e.parameter && e.parameter.padrino) || ''));
    if (accion === 'todosLosRegistros') return jsonResponse(todosLosRegistros_());
    return errorResponse('Acción no reconocida: ' + accion);
  } catch (err) {
    return errorResponse(err.message);
  }
}

function doPost(e) {
  try {
    var datos = JSON.parse(e.postData.contents);
    var accion = datos.accion || '';
    switch (accion) {
      case 'iniciarSede':
        return jsonResponse(iniciarSede_(datos));
      case 'sesionSubida':
        return jsonResponse(sesionSubida_(datos));
      case 'guardarSede':
        return jsonResponse(guardarSede_(datos));
      case 'resembrarCatalogos':
        return jsonResponse(resembrarCatalogos_(datos));
      case 'compartirEvidencias':
        return jsonResponse(compartirEvidencias_(datos));
      case 'migrarEstructuraCarpetas':
        return jsonResponse(migrarEstructuraCarpetas_(datos));
      case 'limpiarHuerfanos':
        return jsonResponse(limpiarHuerfanos_(datos));
      case 'repararEvidenciasFaltantes':
        return jsonResponse(repararEvidenciasFaltantes_(datos));
      case 'listarCarpeta':
        return jsonResponse(listarCarpeta_(datos));
      case 'carpetasSinRegistro':
        return jsonResponse(carpetasSinRegistro_(datos));
      case 'listarPestanas':
        return jsonResponse(listarPestanas_(datos));
      case 'leerRango':
        return jsonResponse(leerRango_(datos));
      case 'eliminarPestana':
        return jsonResponse(eliminarPestana_(datos));
      case 'completarCamposDerivados':
        return jsonResponse(completarCamposDerivados_(datos));
      case 'cargarSedesInforme':
        return jsonResponse(cargarSedesInforme_(datos));
      case 'actualizarNivelInforme':
        return jsonResponse(actualizarNivelInforme_(datos));
      case 'completarDescripcionesInforme':
        return jsonResponse(completarDescripcionesInforme_(datos));
      default:
        return errorResponse('Acción no reconocida: ' + accion);
    }
  } catch (err) {
    return errorResponse(err.message);
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── GET ?accion=catalogos ──────────────────────────────────

function getCatalogos_() {
  var cache = CacheService.getScriptCache();

  var geoCacheado = cache.get('geo_v1');
  var geo;
  if (geoCacheado) {
    geo = JSON.parse(geoCacheado);
  } else {
    geo = construirGeo_();
    cache.put('geo_v1', JSON.stringify(geo), 21600); // 6 horas (máximo permitido)
  }

  return {
    padrinos: leerPadrinos_(),
    geo: geo,
    asignacion: leerAsignacion_(),
    registradas: leerClavesRegistradas_(),
    // Sin caché: son ~736/~760 filas (lectura rápida) y no vale la pena
    // arriesgar el límite de 100 KB por clave de CacheService.
    conectividad: leerConectividad_(),
    simat: leerSimat_(),
  };
}

// Pestaña "Conectividad" del spreadsheet de resultados (agregada a mano por
// el usuario, no la crea el script): Municipio | Institución | Sede |
// DANE Sede | Conectividad ("Si"/"No"). Es dato de catálogo (qué sedes
// tienen internet), independiente de si hubo o no reporte de daño por
// sismo — por eso vive junto a "geo" en catalogos y no en "registros".
function leerConectividad_() {
  var sheet = getSheet_('Conectividad');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var filas = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  return filas
    .filter(function (f) { return String(f[2] || '').trim() !== ''; })
    .map(function (f) {
      return {
        municipio: String(f[0] || '').trim(),
        institucion: String(f[1] || '').trim(),
        sede: String(f[2] || '').trim(),
        daneSede: String(f[3] || '').trim(),
        conectividad: /^s/i.test(String(f[4] || '').trim()), // "Si"/"Sí" → true, "No"/vacío → false
      };
    });
}

function construirGeo_() {
  var geo = {};
  for (var i = 0; i < MUN_IE_SEDE.length; i++) {
    var mun = MUN_IE_SEDE[i][0], ie = MUN_IE_SEDE[i][1], sede = MUN_IE_SEDE[i][2];
    if (!geo[mun]) geo[mun] = {};
    if (!geo[mun][ie]) geo[mun][ie] = [];
    geo[mun][ie].push(sede);
  }
  return geo;
}

function leerPadrinos_() {
  var sheet = getSheet_('padrinos');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var filas = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  return filas
    .filter(function (f) { return String(f[0]).trim() !== ''; })
    .map(function (f) {
      return { nombre: String(f[0]).trim(), correo: String(f[1]).trim(), telefono: String(f[2]).trim() };
    });
}

function leerAsignacion_() {
  var sheet = getSheet_('asignacion');
  var lastRow = sheet.getLastRow();
  var asignacion = {};
  if (lastRow < 2) return asignacion;
  var filas = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  filas.forEach(function (f) {
    var mun = String(f[0]).trim();
    var padrino = String(f[1]).trim();
    if (!mun || !padrino) return;
    if (!asignacion[mun]) asignacion[mun] = [];
    if (asignacion[mun].indexOf(padrino) === -1) asignacion[mun].push(padrino);
  });
  return asignacion;
}

function leerClavesRegistradas_() {
  var sheet = getSheet_('registros');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var filas = sheet.getRange(2, 1, lastRow - 1, COL.SEDE).getValues();
  return filas.map(function (f) {
    return claveSede_(f[COL.MUNICIPIO - 1], f[COL.INSTITUCION - 1], f[COL.SEDE - 1]);
  });
}

// ─── GET ?accion=misRegistros&padrino=... ───────────────────
// Sedes ya guardadas (Borrador o Completo) por un padrino, para que las
// pueda recuperar, editar o completarles la evidencia más adelante.

function misRegistros_(nombrePadrino) {
  var sheet = getSheet_('registros');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2 || !nombrePadrino) return [];

  var clave = normalizarClave_(nombrePadrino);
  var filas = sheet.getRange(2, 1, lastRow - 1, HEADERS_REGISTROS.length).getValues();
  var resultado = [];

  filas.forEach(function (f, i) {
    if (normalizarClave_(f[COL.PADRINO - 1]) !== clave) return;
    var evidencias = [];
    try { evidencias = JSON.parse(f[COL.EVIDENCIAS - 1] || '[]'); } catch (e) { evidencias = []; }

    resultado.push({
      numeroFila: i + 2,
      timestamp: f[0],
      padrino: f[1], correoPadrino: f[2], telefonoPadrino: f[3],
      municipio: f[4], institucion: f[5],
      rectorNombre: f[6], rectorCorreo: f[7], rectorTelefono: f[8],
      sede: f[9], nivel: f[10], descripcion: f[11],
      numFotos: f[12], numVideos: f[13], numDocumentos: f[14], urlSede: f[15],
      evidencias: evidencias,
      estado: f[COL.ESTADO - 1] || 'Borrador',
      matricula: f[COL.MATRICULA - 1], daneSede: f[COL.DANE_SEDE - 1],
    });
  });

  return resultado;
}

// ─── POST accion=iniciarSede ────────────────────────────────
// Crea/reutiliza el árbol de carpetas Municipio/Institución/Sede dentro de
// DRIVE_ROOT_ID — fotos, videos y documentos quedan todos juntos en la
// carpeta de la sede (sin subcarpetas por tipo). Si la sede ya fue guardada
// por OTRO padrino, la bloquea; si es del mismo padrino (retomando un
// borrador), la deja seguir — es idempotente: reutiliza la misma carpeta ya
// creada.

function iniciarSede_(datos) {
  var municipio = String(datos.municipio || '').trim();
  var institucion = String(datos.institucion || '').trim();
  var sede = String(datos.sede || '').trim();
  var padrinoNombre = String(datos.padrino || '').trim();
  if (!municipio || !institucion || !sede) {
    throw new Error('Faltan datos de municipio, institución o sede.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var existente = buscarFilaSede_(municipio, institucion, sede);
    if (existente && normalizarClave_(existente.valores[COL.PADRINO - 1]) !== normalizarClave_(padrinoNombre)) {
      throw new Error(
        'La sede "' + sede + '" de ' + institucion + ' (' + municipio + ') ya fue registrada por ' +
        existente.valores[COL.PADRINO - 1] + ' el ' +
        Utilities.formatDate(new Date(existente.valores[0]), 'America/Bogota', 'dd/MM/yyyy') + '.'
      );
    }

    var raiz = DriveApp.getFolderById(DRIVE_ROOT_ID);
    var carpetaMun = obtenerOCrearCarpeta_(raiz, municipio);
    var carpetaIE = obtenerOCrearCarpeta_(carpetaMun, institucion);
    var carpetaSede = obtenerOCrearCarpeta_(carpetaIE, sede);

    return {
      carpetaSedeId: carpetaSede.getId(),
      urlSede: carpetaSede.getUrl(),
    };
  } finally {
    lock.releaseLock();
  }
}

function obtenerOCrearCarpeta_(carpetaPadre, nombre) {
  var iter = carpetaPadre.getFoldersByName(nombre);
  if (iter.hasNext()) return iter.next();
  return carpetaPadre.createFolder(nombre);
}

// Busca la fila de una sede por su clave natural (Municipio|Institución|Sede).
// Devuelve { numeroFila, valores } (valores = la fila completa tal cual está
// en la hoja) o null si esa sede nunca se ha guardado.
function buscarFilaSede_(municipio, institucion, sede) {
  var sheet = getSheet_('registros');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var clave = claveSede_(municipio, institucion, sede);
  var filas = sheet.getRange(2, 1, lastRow - 1, HEADERS_REGISTROS.length).getValues();
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    if (claveSede_(f[COL.MUNICIPIO - 1], f[COL.INSTITUCION - 1], f[COL.SEDE - 1]) === clave) {
      return { numeroFila: i + 2, valores: f };
    }
  }
  return null;
}

function claveSede_(municipio, institucion, sede) {
  return normalizarClave_(municipio) + '|' + normalizarClave_(institucion) + '|' + normalizarClave_(sede);
}

function normalizarClave_(s) {
  return String(s || '').trim().toLowerCase();
}

// ─── POST accion=sesionSubida ───────────────────────────────
// Firma una sesión de subida reanudable de la Drive API v3 para que el
// navegador suba el archivo DIRECTO a Google (el GAS nunca toca los bytes).
//
// La cabecera Origin es obligatoria aquí: Drive registra el origen permitido
// para CORS en el momento en que se CREA la sesión. Sin ella (UrlFetchApp no
// manda Origin por ser una llamada servidor-servidor), el preflight OPTIONS
// que hace el navegador responde bien igual (es genérico), pero la respuesta
// real de cada PUT de subida nunca trae Access-Control-Allow-Origin y el
// navegador la bloquea — el envío falla con cualquier tipo de archivo. Ya
// pasó en producción: ver commit de fix de subida de evidencias.

function sesionSubida_(datos) {
  var carpetaId = String(datos.carpetaId || '').trim();
  var nombreArchivo = String(datos.nombreArchivo || 'archivo').trim();
  var mimeType = String(datos.mimeType || 'application/octet-stream').trim();

  if (!carpetaId) throw new Error('Falta carpetaId.');
  if (!carpetaDentroDeRaiz_(carpetaId)) throw new Error('Carpeta no autorizada.');

  var token = ScriptApp.getOAuthToken();
  var metadata = { name: nombreArchivo, parents: [carpetaId] };

  var resp = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    {
      method: 'post',
      contentType: 'application/json; charset=UTF-8',
      headers: {
        Authorization: 'Bearer ' + token,
        'X-Upload-Content-Type': mimeType,
        Origin: FRONTEND_ORIGIN,
      },
      payload: JSON.stringify(metadata),
      muteHttpExceptions: true,
    }
  );

  if (resp.getResponseCode() !== 200) {
    throw new Error('No se pudo iniciar la subida a Drive: ' + resp.getContentText());
  }

  var headers = resp.getAllHeaders();
  var uploadUrl = headers['Location'] || headers['location'];
  if (!uploadUrl) throw new Error('Google Drive no devolvió una URL de subida.');

  return { uploadUrl: uploadUrl };
}

// Confirma que carpetaId desciende de DRIVE_ROOT_ID (máx. 8 niveles) antes de
// firmar una sesión de subida, para que nadie use el endpoint con otra carpeta.
function carpetaDentroDeRaiz_(carpetaId) {
  try {
    var actual = DriveApp.getFolderById(carpetaId);
    for (var i = 0; i < 8; i++) {
      if (actual.getId() === DRIVE_ROOT_ID) return true;
      var padres = actual.getParents();
      if (!padres.hasNext()) return false;
      actual = padres.next();
    }
    return false;
  } catch (e) {
    return false;
  }
}

// ─── Campos derivados (Matrícula, DANE, Conectividad) ────────
// Se cruzan por la clave natural Municipio|Institución|Sede contra dos
// fuentes externas: SIMAT_SHEET_ID (matrícula + código DANE de sede) y la
// pestaña "Conectividad" de este mismo spreadsheet. Un mismo par de mapas
// se construye una vez por llamada (guardarSede_ o el backfill admin) en
// vez de releerlos por cada sede.

function leerSimat_() {
  var ss = SpreadsheetApp.openById(SIMAT_SHEET_ID);
  var sheet = ss.getSheetByName('Caldas');
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var filas = sheet.getRange(2, 1, lastRow - 1, 22).getValues();
  return filas
    .filter(function (f) { return String(f[2] || '').trim() !== ''; })
    .map(function (f) {
      return {
        municipio: String(f[0] || '').trim(),
        institucion: String(f[1] || '').trim(),
        sede: String(f[2] || '').trim(),
        matricula: f[15], // columna "TOTAL"
        primaria: f[16], // columna "PRIMARÍA" (suma de grados 0 a 5)
        posprimaria: f[17], // columna sin encabezado (suma de grados 6 a 9)
        media: f[18], // columna "MEDIA" (suma de grados 10 y 11)
        daneSede: String(f[21] || '').trim(), // columna "DANE SEDE"
      };
    });
}

function construirMapasDerivados_() {
  var mapaSimat = {};
  leerSimat_().forEach(function (r) {
    mapaSimat[claveSede_(r.municipio, r.institucion, r.sede)] = r;
  });
  var mapaConectividad = {};
  leerConectividad_().forEach(function (r) {
    mapaConectividad[claveSede_(r.municipio, r.institucion, r.sede)] = r.conectividad;
  });
  return { mapaSimat: mapaSimat, mapaConectividad: mapaConectividad };
}

// Devuelve { matricula, daneSede, conectividad } para una sede puntual.
// "" cuando no hay match en la fuente correspondiente — nunca se inventa
// un valor. "espacios afectados..." no se calcula aquí: se deja vacía en
// guardarSede_ a propósito (sin fuente de datos todavía).
function camposDerivados_(municipio, institucion, sede, mapas) {
  var clave = claveSede_(municipio, institucion, sede);
  var simat = mapas.mapaSimat[clave];
  var conect = mapas.mapaConectividad[clave];
  return {
    matricula: simat ? simat.matricula : '',
    daneSede: simat ? simat.daneSede : '',
    conectividad: conect === true ? 'Si' : conect === false ? 'No' : '',
  };
}

// ─── POST accion=guardarSede ────────────────────────────────
// Guarda (o actualiza, si ya era del mismo padrino) una fila de "registros".
// Todos los campos salvo municipio/institución/sede/padrino son opcionales:
// se puede enviar una sede sin nivel, descripción ni evidencia — queda como
// "Borrador" y el padrino la completa después desde "Mis reportes".

function guardarSede_(datos) {
  var padrino = datos.padrino || {};
  var rector = datos.rector || {};
  var municipio = String(datos.municipio || '').trim();
  var institucion = String(datos.institucion || '').trim();
  var sede = String(datos.sede || '').trim();
  var nivel = String(datos.nivel || '').trim();
  var descripcion = String(datos.descripcion || '').trim();
  var urlSede = String(datos.urlSede || '').trim();
  var evidencias = Array.isArray(datos.evidencias) ? datos.evidencias : [];

  if (!municipio || !institucion || !sede) throw new Error('Faltan datos de municipio, institución o sede.');
  if (!padrino.nombre) throw new Error('Falta el padrino.');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSheet_('registros');
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS_REGISTROS);

    var existente = buscarFilaSede_(municipio, institucion, sede);
    var esPropio = existente && normalizarClave_(existente.valores[COL.PADRINO - 1]) === normalizarClave_(padrino.nombre);
    if (existente && !esPropio) {
      throw new Error('La sede "' + sede + '" ya fue registrada por ' + existente.valores[COL.PADRINO - 1] + '.');
    }

    var fotos = evidencias.filter(function (ev) { return ev.tipo === 'foto'; });
    var videos = evidencias.filter(function (ev) { return ev.tipo === 'video'; });
    var documentos = evidencias.filter(function (ev) { return ev.tipo === 'documento'; });
    var estado = evidencias.length > 0 ? 'Completo' : 'Borrador';
    var derivados = camposDerivados_(municipio, institucion, sede, construirMapasDerivados_());

    var fila = [
      new Date(),
      padrino.nombre || '', padrino.correo || '', padrino.telefono || '',
      municipio, institucion,
      rector.nombre || '', rector.correo || '', rector.telefono || '',
      sede, nivel, descripcion,
      fotos.length, videos.length, documentos.length,
      urlSede, JSON.stringify(evidencias), estado,
      derivados.matricula, derivados.daneSede, '', derivados.conectividad,
    ];

    if (esPropio) {
      sheet.getRange(existente.numeroFila, 1, 1, fila.length).setValues([fila]);
      return { fila: existente.numeroFila, estado: estado, actualizado: true };
    }

    sheet.appendRow(fila);
    return { fila: sheet.getLastRow(), estado: estado, actualizado: false };
  } finally {
    lock.releaseLock();
  }
}

// ─── POST accion=compartirEvidencias (uso único) ────────────
// Pone la carpeta raíz de evidencias en "Cualquiera con el enlace puede
// ver". En Drive (no en Unidades compartidas) esto se hereda dinámicamente
// a todo lo que haya dentro, ya subido o futuro — así los padrinos
// (usuarios anónimos, sin sesión de Google) pueden ver sus fotos, videos y
// documentos desde "Tus reportes guardados" sin pedir acceso.
function compartirEvidencias_(datos) {
  if (String((datos && datos.clave) || '') !== ADMIN_KEY) throw new Error('Clave inválida.');
  var carpeta = DriveApp.getFolderById(DRIVE_ROOT_ID);
  carpeta.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, carpeta: carpeta.getName() };
}

// ─── POST accion=migrarEstructuraCarpetas (uso único) ───────
// Recorre TODA la carpeta raíz (Municipio/Institución/Sede) y, donde
// encuentre subcarpetas "Fotos"/"Videos"/"Documentos" dentro de una sede,
// mueve sus archivos a la carpeta de la sede y borra (a la papelera) la
// subcarpeta vacía. Con datos.dryRun=true no mueve ni borra nada, solo
// cuenta — para revisar el alcance antes de ejecutar de verdad.
function migrarEstructuraCarpetas_(datos) {
  if (String((datos && datos.clave) || '') !== ADMIN_KEY) throw new Error('Clave inválida.');
  var dryRun = !!(datos && datos.dryRun);
  var resultado = { dryRun: dryRun, sedesRevisadas: 0, archivosMovidos: 0, subcarpetasEliminadas: 0 };

  var raiz = DriveApp.getFolderById(DRIVE_ROOT_ID);
  var municipios = raiz.getFolders();
  while (municipios.hasNext()) {
    var instituciones = municipios.next().getFolders();
    while (instituciones.hasNext()) {
      var sedes = instituciones.next().getFolders();
      while (sedes.hasNext()) {
        var carpetaSede = sedes.next();
        resultado.sedesRevisadas++;
        ['Fotos', 'Videos', 'Documentos'].forEach(function (nombreSub) {
          var subIter = carpetaSede.getFoldersByName(nombreSub);
          while (subIter.hasNext()) {
            var sub = subIter.next();
            var archivos = sub.getFiles();
            while (archivos.hasNext()) {
              var archivo = archivos.next();
              if (!dryRun) {
                carpetaSede.addFile(archivo);
                sub.removeFile(archivo);
              }
              resultado.archivosMovidos++;
            }
            if (!dryRun) sub.setTrashed(true);
            resultado.subcarpetasEliminadas++;
          }
        });
      }
    }
  }
  return resultado;
}

// ─── POST accion=limpiarHuerfanos (uso único) ────────────────
// Para cada sede ya guardada en "registros", compara los archivos que hay
// de verdad en su carpeta de Drive contra la lista de evidencias del Sheet
// (la fuente de verdad de lo que debería existir — se sobreescribe completa
// en cada guardarSede_). Un archivo en Drive que no está en esa lista es un
// huérfano: casi siempre una subida repetida de un envío que falló a mitad
// de camino y se reintentó. Con datos.dryRun=true solo reporta, sin borrar.
function limpiarHuerfanos_(datos) {
  if (String((datos && datos.clave) || '') !== ADMIN_KEY) throw new Error('Clave inválida.');
  var dryRun = !!(datos && datos.dryRun);
  var resultado = { dryRun: dryRun, sedesRevisadas: 0, huerfanos: [] };

  var sheet = getSheet_('registros');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return resultado;

  var filas = sheet.getRange(2, 1, lastRow - 1, HEADERS_REGISTROS.length).getValues();
  filas.forEach(function (f, i) {
    var urlSede = String(f[15] || '');
    var idSede = idDeUrlDrive_(urlSede);
    if (!idSede) return;

    var referenciados = {};
    try {
      (JSON.parse(f[16] || '[]')).forEach(function (ev) {
        var id = ev.id || idDeUrlDrive_(ev.url || '');
        if (id) referenciados[id] = true;
      });
    } catch (e) { /* evidencias mal formadas: no se toca nada de esa sede */ return; }

    try {
      var carpeta = DriveApp.getFolderById(idSede);
      var archivos = carpeta.getFiles();
      while (archivos.hasNext()) {
        var archivo = archivos.next();
        var id = archivo.getId();
        if (referenciados[id]) continue;
        resultado.huerfanos.push({
          fila: i + 2, municipio: f[4], institucion: f[5], sede: f[9],
          nombre: archivo.getName(), id: id, tamanoBytes: archivo.getSize(),
        });
        if (!dryRun) archivo.setTrashed(true);
      }
    } catch (e) { /* carpeta no encontrada u otro error: se omite esa sede */ }

    resultado.sedesRevisadas++;
  });

  return resultado;
}

// ─── POST accion=carpetasSinRegistro (solo lectura) ─────────
// Recorre Municipio/Institución/Sede y reporta las carpetas de sede que
// tienen archivos pero NINGUNA fila correspondiente en "registros" — casi
// siempre evidencia que sí se subió pero cuyo envío nunca llegó a
// guardarSede_ (falló a mitad de camino, p. ej. por el bug de CORS ya
// corregido). No borra nada — es puramente informativo, para decidir si
// hay que avisarle al padrino que retome esa sede.
function carpetasSinRegistro_(datos) {
  if (String((datos && datos.clave) || '') !== ADMIN_KEY) throw new Error('Clave inválida.');

  var claves = {};
  var sheet = getSheet_('registros');
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var filas = sheet.getRange(2, 1, lastRow - 1, HEADERS_REGISTROS.length).getValues();
    filas.forEach(function (f) {
      claves[claveSede_(f[COL.MUNICIPIO - 1], f[COL.INSTITUCION - 1], f[COL.SEDE - 1])] = true;
    });
  }

  var resultado = { sedesSinRegistro: [] };
  var raiz = DriveApp.getFolderById(DRIVE_ROOT_ID);
  var municipios = raiz.getFolders();
  while (municipios.hasNext()) {
    var carpetaMun = municipios.next();
    var instituciones = carpetaMun.getFolders();
    while (instituciones.hasNext()) {
      var carpetaIE = instituciones.next();
      var sedes = carpetaIE.getFolders();
      while (sedes.hasNext()) {
        var carpetaSede = sedes.next();
        var clave = claveSede_(carpetaMun.getName(), carpetaIE.getName(), carpetaSede.getName());
        if (claves[clave]) continue;

        var archivos = [];
        var iterArch = carpetaSede.getFiles();
        while (iterArch.hasNext()) {
          var a = iterArch.next();
          archivos.push({ nombre: a.getName(), tamanoBytes: a.getSize(), id: a.getId() });
        }
        var subs = carpetaSede.getFolders();
        while (subs.hasNext()) {
          var sub = subs.next();
          var iterArch2 = sub.getFiles();
          while (iterArch2.hasNext()) {
            var a2 = iterArch2.next();
            archivos.push({ nombre: sub.getName() + '/' + a2.getName(), tamanoBytes: a2.getSize(), id: a2.getId() });
          }
        }

        if (archivos.length > 0) {
          resultado.sedesSinRegistro.push({
            municipio: carpetaMun.getName(), institucion: carpetaIE.getName(), sede: carpetaSede.getName(),
            urlSede: carpetaSede.getUrl(), archivos: archivos,
          });
        }
      }
    }
  }
  return resultado;
}

// ─── POST accion=listarCarpeta (diagnóstico, solo lectura) ──
// Lista archivos y subcarpetas de una carpeta puntual — para revisar a
// mano si una subida realmente llegó a Drive aunque el Sheet no la tenga.
function listarCarpeta_(datos) {
  if (String((datos && datos.clave) || '') !== ADMIN_KEY) throw new Error('Clave inválida.');
  var carpetaId = String((datos && datos.carpetaId) || '').trim();
  if (!carpetaId) throw new Error('Falta carpetaId.');

  var carpeta = DriveApp.getFolderById(carpetaId);
  var archivos = [];
  var iterArch = carpeta.getFiles();
  while (iterArch.hasNext()) {
    var a = iterArch.next();
    archivos.push({ nombre: a.getName(), tamanoBytes: a.getSize(), id: a.getId(), creado: a.getDateCreated() });
  }
  var subcarpetas = [];
  var iterSub = carpeta.getFolders();
  while (iterSub.hasNext()) {
    subcarpetas.push(iterSub.next().getName());
  }
  return { nombre: carpeta.getName(), archivos: archivos, subcarpetas: subcarpetas };
}

function idDeUrlDrive_(url) {
  var m = /\/d\/([^/]+)/.exec(url) || /folders\/([^/?]+)/.exec(url);
  return m ? m[1] : '';
}

// ─── POST accion=listarPestanas (diagnóstico, solo lectura) ─
// Lista las pestañas de un spreadsheet cualquiera (por ID) con su
// encabezado y cantidad de filas — para ubicar en qué pestaña/columna vive
// un dato nuevo antes de decidir cómo conectarlo al backend.
function listarPestanas_(datos) {
  if (String((datos && datos.clave) || '') !== ADMIN_KEY) throw new Error('Clave inválida.');
  var spreadsheetId = String((datos && datos.spreadsheetId) || '').trim();
  if (!spreadsheetId) throw new Error('Falta spreadsheetId.');

  var ss = SpreadsheetApp.openById(spreadsheetId);
  var pestanas = ss.getSheets().map(function (sheet) {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var encabezado = lastRow > 0 && lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    return { nombre: sheet.getName(), filas: lastRow, columnas: lastCol, encabezado: encabezado };
  });
  return { nombreArchivo: ss.getName(), pestanas: pestanas };
}

// ─── POST accion=leerRango (diagnóstico, solo lectura) ───────
// Lee un rango de filas de una pestaña puntual de cualquier spreadsheet —
// para revisar valores reales antes de decidir cómo conectar un dato nuevo.
function leerRango_(datos) {
  if (String((datos && datos.clave) || '') !== ADMIN_KEY) throw new Error('Clave inválida.');
  var spreadsheetId = String((datos && datos.spreadsheetId) || '').trim();
  var nombrePestana = String((datos && datos.pestana) || '').trim();
  var desde = Number((datos && datos.desde) || 1);
  var cantidad = Number((datos && datos.cantidad) || 20);
  if (!spreadsheetId || !nombrePestana) throw new Error('Falta spreadsheetId o pestana.');

  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(nombrePestana);
  if (!sheet) throw new Error('No existe la pestaña "' + nombrePestana + '".');
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  var hasta = Math.min(desde + cantidad - 1, lastRow);
  if (hasta < desde) return { filas: [] };
  var valores = sheet.getRange(desde, 1, hasta - desde + 1, lastCol).getValues();
  return { filas: valores, lastRow: lastRow, lastCol: lastCol };
}

// ─── POST accion=eliminarPestana (uso único) ─────────────────
// Borra una pestaña puntual de un spreadsheet — para el caso de unificar
// pestañas duplicadas (p. ej. "exportar" una vez que "registros" ya tiene
// sus mismas columnas derivadas rellenas). Recuperable desde el historial
// de versiones del Sheet si hace falta, no es un borrado sin rastro.
function eliminarPestana_(datos) {
  if (String((datos && datos.clave) || '') !== ADMIN_KEY) throw new Error('Clave inválida.');
  var spreadsheetId = String((datos && datos.spreadsheetId) || '').trim();
  var nombrePestana = String((datos && datos.pestana) || '').trim();
  if (!spreadsheetId || !nombrePestana) throw new Error('Falta spreadsheetId o pestana.');

  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(nombrePestana);
  if (!sheet) throw new Error('No existe la pestaña "' + nombrePestana + '".');
  ss.deleteSheet(sheet);
  return { ok: true, eliminada: nombrePestana };
}

// ─── POST accion=completarCamposDerivados (uso único) ────────
// Recalcula Matrícula/código DANE/Conectividad (las columnas 19, 20 y 22)
// para TODAS las filas de "registros" ya guardadas, con la misma lógica
// que guardarSede_ usa para las nuevas (camposDerivados_). Pensada para
// unificar "registros" con la pestaña "exportar" (que traía estas mismas
// columnas ya calculadas a mano): en vez de copiar sus valores, se
// recalculan frescos aquí para que ambas tablas queden con exactamente la
// misma lógica de cruce. La columna "espacios afectados..." se deja
// intacta (sin fuente de datos todavía). Con datos.dryRun=true solo
// reporta, sin escribir nada.
function completarCamposDerivados_(datos) {
  if (String((datos && datos.clave) || '') !== ADMIN_KEY) throw new Error('Clave inválida.');
  var dryRun = !!(datos && datos.dryRun);
  var resultado = { dryRun: dryRun, filasRevisadas: 0, filasActualizadas: [] };

  var sheet = getSheet_('registros');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return resultado;

  var mapas = construirMapasDerivados_();
  var filas = sheet.getRange(2, 1, lastRow - 1, HEADERS_REGISTROS.length).getValues();
  filas.forEach(function (f, i) {
    resultado.filasRevisadas++;
    var municipio = f[COL.MUNICIPIO - 1], institucion = f[COL.INSTITUCION - 1], sede = f[COL.SEDE - 1];
    var derivados = camposDerivados_(municipio, institucion, sede, mapas);

    var anterior = { matricula: f[COL.MATRICULA - 1], daneSede: f[COL.DANE_SEDE - 1], conectividad: f[COL.CONECTIVIDAD - 1] };
    var cambia = String(anterior.matricula) !== String(derivados.matricula) ||
      String(anterior.daneSede) !== String(derivados.daneSede) ||
      String(anterior.conectividad) !== String(derivados.conectividad);
    if (!cambia) return;

    resultado.filasActualizadas.push({
      fila: i + 2, municipio: municipio, institucion: institucion, sede: sede,
      anterior: anterior, nuevo: derivados,
    });

    if (!dryRun) {
      sheet.getRange(i + 2, COL.MATRICULA).setValue(derivados.matricula);
      sheet.getRange(i + 2, COL.DANE_SEDE).setValue(derivados.daneSede);
      sheet.getRange(i + 2, COL.CONECTIVIDAD).setValue(derivados.conectividad);
    }
  });

  return resultado;
}

// ─── POST accion=cargarSedesInforme (uso único) ──────────────
// Carga sedes nuevas desde un censo externo (p. ej. un informe de la
// Secretaría/Gobernación) que no pasó por el formulario de los padrinos:
// trae Municipio/Institución/Sede/Nivel pero no descripción ni evidencia.
// datos.filas: [{ municipio, institucion, sede, nivel, rectorNombre?,
// rectorCorreo?, rectorTelefono? }, ...] — ya resueltos contra el
// catálogo (municipio/institución/sede canónicos) antes de llamar esta
// acción; esta función NO valida contra MUN_IE_SEDE.
//
// El padrino de todas las filas nuevas es "Alejandro Osorio Loaiza" (se
// busca en la pestaña "padrinos" para tomar su correo/teléfono reales) —
// el censo no trae padrino. Cada sede se guarda llamando directamente a
// guardarSede_ con descripcion:'' y evidencias:[], así se reutiliza toda
// su lógica (camposDerivados_, cálculo de Estado, forma de la fila) en
// vez de reimplementarla. Sedes que ya existan en "registros" se omiten
// (red de seguridad — no debería pasar si datos.filas ya viene filtrado).
//
// Con datos.dryRun=true no llama a guardarSede_ (no escribe nada): solo
// cuenta cuántas se insertarían y arma una muestra de 5 con los campos
// derivados que les tocaría, para revisar antes de ejecutar de verdad.
function cargarSedesInforme_(datos) {
  if (String((datos && datos.clave) || '') !== ADMIN_KEY) throw new Error('Clave inválida.');
  var dryRun = !!(datos && datos.dryRun);
  var filas = Array.isArray(datos && datos.filas) ? datos.filas : [];

  var padrinoDefault = leerPadrinos_().filter(function (p) {
    return normalizarClave_(p.nombre) === normalizarClave_('Alejandro Osorio Loaiza');
  })[0];
  if (!padrinoDefault) throw new Error('No se encontró a Alejandro Osorio Loaiza en la pestaña "padrinos".');

  var resultado = { dryRun: dryRun, total: filas.length, insertadas: 0, omitidas: [], errores: [], muestra: [] };
  var mapas = dryRun ? construirMapasDerivados_() : null;

  filas.forEach(function (f) {
    var municipio = String(f.municipio || '').trim();
    var institucion = String(f.institucion || '').trim();
    var sede = String(f.sede || '').trim();
    if (!municipio || !institucion || !sede) {
      resultado.errores.push({ municipio: municipio, institucion: institucion, sede: sede, error: 'Faltan datos.' });
      return;
    }

    var existente = buscarFilaSede_(municipio, institucion, sede);
    if (existente) {
      resultado.omitidas.push({ municipio: municipio, institucion: institucion, sede: sede, motivo: 'ya existe en registros' });
      return;
    }

    if (dryRun) {
      var derivados = camposDerivados_(municipio, institucion, sede, mapas);
      resultado.insertadas++;
      if (resultado.muestra.length < 5) {
        resultado.muestra.push({
          municipio: municipio, institucion: institucion, sede: sede, nivel: f.nivel || '',
          rector: f.rectorNombre || '(sin rector)',
          matricula: derivados.matricula, daneSede: derivados.daneSede, conectividad: derivados.conectividad,
        });
      }
      return;
    }

    try {
      guardarSede_({
        padrino: padrinoDefault,
        rector: { nombre: f.rectorNombre || '', correo: f.rectorCorreo || '', telefono: f.rectorTelefono || '' },
        municipio: municipio, institucion: institucion, sede: sede,
        nivel: f.nivel || '', descripcion: '', evidencias: [],
      });
      resultado.insertadas++;
    } catch (e) {
      resultado.errores.push({ municipio: municipio, institucion: institucion, sede: sede, error: e.message });
    }
  });

  return resultado;
}

// ─── POST accion=actualizarNivelInforme (uso único) ──────────
// Para sedes que YA tienen un reporte de un padrino, actualiza SOLO la
// columna "Nivel de afectación" con el dato de un censo externo más
// reciente/prioritario — nunca toca descripción, evidencia, estado,
// padrino ni rector. datos.filas: [{ municipio, institucion, sede,
// nivelNuevo }, ...]. Si la sede no existe en "registros" se reporta en
// noEncontradas (no se crea). Si el nivel ya es igual, no se escribe.
// Con datos.dryRun=true solo reporta cuántas cambiarían.
function actualizarNivelInforme_(datos) {
  if (String((datos && datos.clave) || '') !== ADMIN_KEY) throw new Error('Clave inválida.');
  var dryRun = !!(datos && datos.dryRun);
  var filas = Array.isArray(datos && datos.filas) ? datos.filas : [];
  var resultado = { dryRun: dryRun, total: filas.length, actualizadas: 0, sinCambio: 0, noEncontradas: [] };

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSheet_('registros');
    filas.forEach(function (f) {
      var municipio = String(f.municipio || '').trim();
      var institucion = String(f.institucion || '').trim();
      var sede = String(f.sede || '').trim();
      var nivelNuevo = String(f.nivelNuevo || '').trim();

      var existente = buscarFilaSede_(municipio, institucion, sede);
      if (!existente) {
        resultado.noEncontradas.push({ municipio: municipio, institucion: institucion, sede: sede });
        return;
      }

      var nivelActual = String(existente.valores[10] || '');
      if (nivelActual === nivelNuevo) {
        resultado.sinCambio++;
        return;
      }

      resultado.actualizadas++;
      if (!dryRun) sheet.getRange(existente.numeroFila, 11).setValue(nivelNuevo);
    });
  } finally {
    lock.releaseLock();
  }

  return resultado;
}

// ─── POST accion=completarDescripcionesInforme (uso único) ──
// Para sedes que llegaron por cargarSedesInforme_ sin descripción del daño
// ni evidencia (el censo de la Secretaría de Educación no trae ninguna de
// las dos), agrega un texto de descripción genérico que deja claro el
// origen del dato — así el detalle de sede en el panel no queda en blanco
// mientras el padrino asignado no la visite. Solo toca la columna
// "Descripción del daño"; nunca una sede que ya tenga descripción propia o
// al menos una evidencia (aunque su Nivel también venga del mismo censo,
// vía actualizarNivelInforme_ — esa sí es una sede con reporte real).
// Con datos.dryRun=true solo reporta, sin escribir.
var DESCRIPCION_INFORME_SED = 'Información suministrada por la Secretaría de Educación de ' +
  'Caldas (Informe Ejecutivo de Sedes Afectadas, sismo del 10 de agosto de 2026) que indica ' +
  'el nivel de afectación de esta sede. Aún no cuenta con descripción detallada ni evidencia ' +
  'fotográfica — pendiente de que el padrino asignado la visite.';

function completarDescripcionesInforme_(datos) {
  if (String((datos && datos.clave) || '') !== ADMIN_KEY) throw new Error('Clave inválida.');
  var dryRun = !!(datos && datos.dryRun);
  var resultado = { dryRun: dryRun, filasRevisadas: 0, actualizadas: [] };

  var sheet = getSheet_('registros');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return resultado;

  var filas = sheet.getRange(2, 1, lastRow - 1, HEADERS_REGISTROS.length).getValues();
  filas.forEach(function (f, i) {
    resultado.filasRevisadas++;
    var descripcion = String(f[COL.DESCRIPCION - 1] || '').trim();
    if (descripcion) return;

    var evidencias;
    try { evidencias = JSON.parse(f[COL.EVIDENCIAS - 1] || '[]'); } catch (e) { evidencias = []; }
    if (evidencias.length > 0) return;

    resultado.actualizadas.push({
      fila: i + 2, municipio: f[COL.MUNICIPIO - 1], institucion: f[COL.INSTITUCION - 1], sede: f[COL.SEDE - 1],
    });
    if (!dryRun) sheet.getRange(i + 2, COL.DESCRIPCION).setValue(DESCRIPCION_INFORME_SED);
  });

  return resultado;
}

// ─── POST accion=repararEvidenciasFaltantes (uso único) ─────
// Para cada sede en "registros" que quedó en Borrador con CERO evidencias
// registradas, revisa si su carpeta de Drive en realidad sí tiene archivos
// (subida que sí llegó a Drive pero cuyo guardarSede_ final nunca se
// completó — mismo síntoma que motivó el aviso de "sede sin evidencia"
// antes de enviar). Si hay archivos, los agrega a "Evidencias (JSON)" y
// pasa el Estado a "Completo".
//
// Ojo con reintentos: si el padrino reenvió la sede completa más de una vez
// tras el fallo, puede haber varias copias del mismo archivo (mismo tamaño
// en bytes) en la carpeta. Se conserva solo la copia más antigua de cada
// tamaño distinto como evidencia real; las demás se mandan a la papelera
// (no se cuentan como evidencia duplicada).
//
// Sedes que YA tenían al menos una evidencia registrada no se tocan aquí —
// si su carpeta tiene archivos extra sin referenciar, es el mismo patrón de
// reintento duplicado y lo resuelve limpiarHuerfanos_ (that pass no vuelve
// a contarlos como evidencia nueva, los manda a la papelera directamente).
// Aparte, para cualquier sede con evidencia ya registrada que seguía en
// Borrador solo por falta de descripción, se corrige el Estado a "Completo"
// sin tocar archivos (mismo criterio que ahora usa guardarSede_: tener
// evidencia basta para estar completa).
//
// Con datos.dryRun=true solo reporta, sin escribir ni borrar nada.
function repararEvidenciasFaltantes_(datos) {
  if (String((datos && datos.clave) || '') !== ADMIN_KEY) throw new Error('Clave inválida.');
  var dryRun = !!(datos && datos.dryRun);
  var resultado = { dryRun: dryRun, sedesRevisadas: 0, sedesReparadas: [] };

  var sheet = getSheet_('registros');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return resultado;

  var filas = sheet.getRange(2, 1, lastRow - 1, HEADERS_REGISTROS.length).getValues();
  filas.forEach(function (f, i) {
    var urlSede = String(f[15] || '');
    var idSede = idDeUrlDrive_(urlSede);
    if (!idSede) return;
    resultado.sedesRevisadas++;

    var evidenciasActuales = [];
    try { evidenciasActuales = JSON.parse(f[16] || '[]'); } catch (e) { evidenciasActuales = []; }
    var estadoAnterior = f[17] || 'Borrador';

    var nuevasEvidencias = evidenciasActuales;
    var duplicadosDescartados = [];

    if (evidenciasActuales.length === 0) {
      var archivosReales;
      try {
        var carpeta = DriveApp.getFolderById(idSede);
        archivosReales = [];
        var iter = carpeta.getFiles();
        while (iter.hasNext()) archivosReales.push(iter.next());
      } catch (e) { return; } // carpeta no encontrada: se omite esa sede

      if (archivosReales.length > 0) {
        // Deduplicar por tamaño en bytes (mismo tamaño = mismo archivo
        // reenviado): se conserva el más antiguo de cada grupo.
        archivosReales.sort(function (a, b) { return a.getDateCreated() - b.getDateCreated(); });
        var vistosPorTamano = {};
        archivosReales.forEach(function (archivo) {
          var tamano = archivo.getSize();
          if (vistosPorTamano[tamano]) {
            duplicadosDescartados.push(archivo);
            return;
          }
          vistosPorTamano[tamano] = archivo;
        });

        nuevasEvidencias = Object.keys(vistosPorTamano).map(function (tamano) {
          var archivo = vistosPorTamano[tamano];
          return {
            nombre: archivo.getName(),
            url: 'https://drive.google.com/file/d/' + archivo.getId() + '/view',
            tipo: tipoPorNombreArchivo_(archivo.getName()),
            id: archivo.getId(),
          };
        });
      }
    }

    var nuevoEstado = nuevasEvidencias.length > 0 ? 'Completo' : estadoAnterior;
    var cambioEvidencias = nuevasEvidencias !== evidenciasActuales;
    if (!cambioEvidencias && nuevoEstado === estadoAnterior) return; // nada que hacer

    if (cambioEvidencias) {
      resultado.sedesReparadas.push({
        fila: i + 2, municipio: f[4], institucion: f[5], sede: f[9],
        archivosAgregados: nuevasEvidencias.map(function (ev) { return ev.nombre; }),
        duplicadosDescartados: duplicadosDescartados.map(function (a) { return a.getName(); }),
        estadoAnterior: estadoAnterior, estadoNuevo: nuevoEstado,
      });
    } else {
      resultado.sedesReparadas.push({
        fila: i + 2, municipio: f[4], institucion: f[5], sede: f[9],
        soloEstado: true, estadoAnterior: estadoAnterior, estadoNuevo: nuevoEstado,
      });
    }

    if (!dryRun) {
      if (cambioEvidencias) {
        var fotos = nuevasEvidencias.filter(function (ev) { return ev.tipo === 'foto'; });
        var videos = nuevasEvidencias.filter(function (ev) { return ev.tipo === 'video'; });
        var documentos = nuevasEvidencias.filter(function (ev) { return ev.tipo === 'documento'; });
        sheet.getRange(i + 2, 13).setValue(fotos.length);
        sheet.getRange(i + 2, 14).setValue(videos.length);
        sheet.getRange(i + 2, 15).setValue(documentos.length);
        sheet.getRange(i + 2, 17).setValue(JSON.stringify(nuevasEvidencias));
        duplicadosDescartados.forEach(function (archivo) { archivo.setTrashed(true); });
      }
      sheet.getRange(i + 2, 18).setValue(nuevoEstado);
    }
  });

  return resultado;
}

function tipoPorNombreArchivo_(nombre) {
  if (/-FOTO-/.test(nombre)) return 'foto';
  if (/-VIDEO-/.test(nombre)) return 'video';
  return 'documento';
}

// ─── GET/POST accion=todosLosRegistros ──────────────────────
// Todas las sedes registradas (de cualquier padrino), para el dashboard de
// control. A diferencia de misRegistros_ (que filtra por un padrino), esto
// no filtra nada — es de solo lectura, no requiere clave: la evidencia ya
// es visible por enlace de todos modos (ver compartirEvidencias_).
function todosLosRegistros_() {
  var sheet = getSheet_('registros');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var filas = sheet.getRange(2, 1, lastRow - 1, HEADERS_REGISTROS.length).getValues();
  return filas.map(function (f, i) {
    var evidencias = [];
    try { evidencias = JSON.parse(f[16] || '[]'); } catch (e) { evidencias = []; }
    return {
      numeroFila: i + 2,
      timestamp: f[0],
      padrino: f[1], correoPadrino: f[2], telefonoPadrino: f[3],
      municipio: f[4], institucion: f[5],
      rectorNombre: f[6], rectorCorreo: f[7], rectorTelefono: f[8],
      sede: f[9], nivel: f[10], descripcion: f[11],
      numFotos: f[12], numVideos: f[13], numDocumentos: f[14],
      urlSede: f[15], evidencias: evidencias,
      estado: f[17] || 'Borrador',
      matricula: f[COL.MATRICULA - 1], daneSede: f[COL.DANE_SEDE - 1],
    };
  });
}

// ─── Funciones auxiliares para leer/escribir el spreadsheet ─

function getResultsSpreadsheet_() {
  return SpreadsheetApp.openById(RESULTS_SHEET_ID);
}

function getSheet_(nombre) {
  var ss = getResultsSpreadsheet_();
  var sheet = ss.getSheetByName(nombre);
  if (!sheet) sheet = ss.insertSheet(nombre);
  return sheet;
}

// ─── POST accion=resembrarCatalogos ─────────────────────────
// Reescribe por completo las pestañas "padrinos" y "asignacion" con lo que
// haya en PADRINOS_SEED/ASIGNACION_SEED — útil cuando cambia la lista de
// padrinos sin tener que abrir el editor de Apps Script. También corrige el
// encabezado de "registros" si cambió (HEADERS_REGISTROS) y esa hoja todavía
// no tiene filas reales — nunca toca filas con datos ya guardados.

function resembrarCatalogos_(datos) {
  if (String((datos && datos.clave) || '') !== ADMIN_KEY) {
    throw new Error('Clave inválida.');
  }

  var ss = getResultsSpreadsheet_();

  var hReg = ss.getSheetByName('registros') || ss.insertSheet('registros');
  if (hReg.getLastRow() <= 1) {
    hReg.clear();
    hReg.appendRow(HEADERS_REGISTROS);
  }

  var hPad = ss.getSheetByName('padrinos') || ss.insertSheet('padrinos');
  hPad.clearContents();
  hPad.appendRow(['Nombre', 'Correo', 'Teléfono']);
  hPad.getRange(2, 1, PADRINOS_SEED.length, 3).setValues(PADRINOS_SEED);

  var hAsig = ss.getSheetByName('asignacion') || ss.insertSheet('asignacion');
  hAsig.clearContents();
  hAsig.appendRow(['Municipio', 'Padrino']);
  hAsig.getRange(2, 1, ASIGNACION_SEED.length, 2).setValues(ASIGNACION_SEED);

  return { padrinos: PADRINOS_SEED.length, asignacion: ASIGNACION_SEED.length };
}

// ─── Inicialización (ejecutar UNA vez a mano) ───────────────
// El spreadsheet (RESULTS_SHEET_ID) ya existe dentro de la carpeta de
// evidencias — esta función solo crea/siembra sus pestañas la primera vez.

function inicializar() {
  var ss = getResultsSpreadsheet_();

  var hReg = ss.getSheetByName('registros') || ss.insertSheet('registros');
  if (hReg.getLastRow() === 0) hReg.appendRow(HEADERS_REGISTROS);

  var hPad = ss.getSheetByName('padrinos') || ss.insertSheet('padrinos');
  if (hPad.getLastRow() === 0) {
    hPad.appendRow(['Nombre', 'Correo', 'Teléfono']);
    hPad.getRange(2, 1, PADRINOS_SEED.length, 3).setValues(PADRINOS_SEED);
  }

  var hAsig = ss.getSheetByName('asignacion') || ss.insertSheet('asignacion');
  if (hAsig.getLastRow() === 0) {
    hAsig.appendRow(['Municipio', 'Padrino']);
    hAsig.getRange(2, 1, ASIGNACION_SEED.length, 2).setValues(ASIGNACION_SEED);
  }

  var hojaPorDefecto = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hojaPorDefecto && ss.getSheets().length > 1) ss.deleteSheet(hojaPorDefecto);

  Logger.log('Listo. RESULTS_SHEET_ID = ' + ss.getId());
  Logger.log('URL del spreadsheet: ' + ss.getUrl());
}
