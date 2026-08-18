// ================================================
// Encuesta de Daños por Sismo — lógica del formulario
// Catálogos, cascadas Municipio→Institución→Sede, repetidores de
// institución/sede, borrador local, "Mis reportes" (recuperar/editar lo ya
// guardado en el servidor), validación y envío secuencial.
// ================================================

const CLAVE_BORRADOR = 'encuesta_sismo_borrador';

let catalogos = null; // { padrinos, geo, asignacion, registradas }
let registradasSet = new Set();

let elPadrino, elPadrinoCorreo, elPadrinoTelefono;

// ─── Utilidades ──────────────────────────────────────────────

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function claveSede(municipio, institucion, sede) {
  const norm = (s) => String(s || '').trim().toLowerCase();
  return norm(municipio) + '|' + norm(institucion) + '|' + norm(sede);
}

function formatearPeso(bytes) {
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function iconoSvg(id) {
  return `<svg class="icono-svg" aria-hidden="true"><use href="#${id}"></use></svg>`;
}

// Icono de estado para las filas de la lista de progreso de envío.
function estadoIconoMarkup(estado) {
  if (estado === 'ok') return iconoSvg('icono-check-circulo');
  if (estado === 'error') return iconoSvg('icono-alerta');
  if (estado === 'activo') return '<div class="spinner-sm"></div>';
  return iconoSvg('icono-circulo'); // pendiente
}

async function postGAS(payload) {
  const res = await fetch(CONFIG.GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // evita el preflight CORS que GAS no maneja
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json;
}

// ─── Carga inicial de catálogos ─────────────────────────────

async function cargarCatalogos() {
  try {
    const res = await fetch(`${CONFIG.GAS_URL}?accion=catalogos`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);

    catalogos = json.data;
    registradasSet = new Set(catalogos.registradas || []);

    poblarPadrinos();

    document.getElementById('cargandoCatalogos').classList.add('oculto');
    document.getElementById('formulario').classList.remove('oculto');

    restaurarBorrador();
    actualizarEstadoBotonEnviar();
    if (elPadrino.value) cargarMisReportes();
  } catch (err) {
    document.getElementById('cargandoCatalogos').classList.add('oculto');
    document.getElementById('errorCatalogos').classList.remove('oculto');
  }
}

function poblarPadrinos() {
  catalogos.padrinos.forEach((p) => elPadrino.add(new Option(p.nombre, p.nombre)));
}

function poblarMunicipios(select, valorPrevio) {
  select.innerHTML = '<option value="">— Selecciona un municipio —</option>';

  const todos = Object.keys(catalogos.geo).sort();
  const nombrePadrino = elPadrino.value;
  const tuyos = todos.filter((m) => (catalogos.asignacion[m] || []).includes(nombrePadrino));
  const otros = todos.filter((m) => tuyos.indexOf(m) === -1);

  if (tuyos.length > 0) {
    const grupo = document.createElement('optgroup');
    grupo.label = 'Tus municipios';
    tuyos.forEach((m) => grupo.appendChild(new Option(m, m)));
    select.appendChild(grupo);
  }

  const grupoOtros = document.createElement('optgroup');
  grupoOtros.label = tuyos.length > 0 ? 'Otros municipios' : 'Municipios';
  otros.forEach((m) => grupoOtros.appendChild(new Option(m, m)));
  select.appendChild(grupoOtros);

  if (valorPrevio) select.value = valorPrevio;
}

// ─── Repetidor: institución ──────────────────────────────────
// `prellenado`, si se pasa, viene de "Mis reportes": fija municipio e
// institución (no tiene sentido cambiarlas al editar un registro existente).

function agregarInstitucion(prellenado) {
  const tpl = document.getElementById('plantillaInstitucion');
  const nodo = tpl.content.firstElementChild.cloneNode(true);
  document.getElementById('listaInstituciones').appendChild(nodo);

  const selMunicipio = nodo.querySelector('[data-role="municipio"]');
  const selInstitucion = nodo.querySelector('[data-role="institucion"]');
  const btnAgregarSede = nodo.querySelector('[data-role="agregar-sede"]');
  const btnQuitarInstitucion = nodo.querySelector('[data-role="quitar-institucion"]');

  if (prellenado) {
    selMunicipio.innerHTML = `<option value="${prellenado.municipio}">${prellenado.municipio}</option>`;
    selMunicipio.value = prellenado.municipio;
    selMunicipio.disabled = true;

    selInstitucion.innerHTML = `<option value="${prellenado.institucion}">${prellenado.institucion}</option>`;
    selInstitucion.value = prellenado.institucion;
    selInstitucion.disabled = true;

    nodo.querySelector('[data-role="rector-nombre"]').value = prellenado.rectorNombre || '';
    nodo.querySelector('[data-role="rector-correo"]').value = prellenado.rectorCorreo || '';
    nodo.querySelector('[data-role="rector-telefono"]').value = prellenado.rectorTelefono || '';

    btnAgregarSede.disabled = false; // se puede reportar otra sede de la misma institución de una vez
  } else {
    poblarMunicipios(selMunicipio);

    selMunicipio.addEventListener('change', () => {
      selInstitucion.innerHTML = '<option value="">— Selecciona una institución —</option>';
      selInstitucion.disabled = true;
      btnAgregarSede.disabled = true;
      nodo.querySelector('[data-role="sedes-lista"]').innerHTML = '';
      actualizarEstadoBotonEnviar();

      if (!selMunicipio.value) return;
      const ies = Object.keys(catalogos.geo[selMunicipio.value] || {}).sort();
      ies.forEach((ie) => selInstitucion.add(new Option(ie, ie)));
      selInstitucion.disabled = false;
    });

    selInstitucion.addEventListener('change', () => {
      nodo.querySelector('[data-role="sedes-lista"]').innerHTML = '';
      btnAgregarSede.disabled = !selInstitucion.value;
      actualizarEstadoBotonEnviar();
      guardarBorrador();
    });
  }

  btnAgregarSede.addEventListener('click', () => agregarSede(nodo));

  btnQuitarInstitucion.addEventListener('click', () => {
    nodo.remove();
    actualizarEstadoBotonEnviar();
    guardarBorrador();
  });

  ['rector-nombre', 'rector-correo', 'rector-telefono'].forEach((rol) => {
    nodo.querySelector(`[data-role="${rol}"]`).addEventListener('input', debounce(guardarBorrador, 400));
  });

  if (!prellenado) guardarBorrador();
  return nodo;
}

// ─── Repetidor: sede ─────────────────────────────────────────
// `prellenado`, si se pasa, viene de "Mis reportes": fija la sede (no tiene
// sentido cambiar de sede al editar un registro existente) y precarga nivel,
// descripción, evidencias ya subidas y el número de fila para actualizar.

function agregarSede(institucionNodo, prellenado) {
  const tpl = document.getElementById('plantillaSede');
  const nodo = tpl.content.firstElementChild.cloneNode(true);
  institucionNodo.querySelector('[data-role="sedes-lista"]').appendChild(nodo);
  nodo._archivos = { fotos: [], videos: [], documentos: [] };
  nodo._archivosExistentes = (prellenado && prellenado.evidencias) ? prellenado.evidencias.slice() : [];
  nodo._numeroFila = prellenado ? prellenado.numeroFila : null;

  const selSede = nodo.querySelector('[data-role="sede"]');
  const chipsWrap = nodo.querySelector('[data-role="nivel-chips"]');
  const descripcion = nodo.querySelector('[data-role="descripcion"]');
  const fotosInput = nodo.querySelector('[data-role="fotos-input"]');
  const videosInput = nodo.querySelector('[data-role="videos-input"]');
  const documentosInput = nodo.querySelector('[data-role="documentos-input"]');
  const fotosLista = nodo.querySelector('[data-role="fotos-lista"]');
  const videosLista = nodo.querySelector('[data-role="videos-lista"]');
  const documentosLista = nodo.querySelector('[data-role="documentos-lista"]');
  const btnQuitarSede = nodo.querySelector('[data-role="quitar-sede"]');

  if (prellenado) {
    selSede.innerHTML = `<option value="${prellenado.sede}">${prellenado.sede}</option>`;
    selSede.value = prellenado.sede;
    selSede.disabled = true;

    if (prellenado.nivel) {
      const chip = nodo.querySelector(`.chip[data-nivel="${prellenado.nivel}"]`);
      if (chip) chip.classList.add('activo');
      chipsWrap.dataset.valor = prellenado.nivel;
    }
    descripcion.value = prellenado.descripcion || '';
    renderArchivosExistentes(nodo, fotosLista, videosLista, documentosLista);

    const badge = document.createElement('span');
    badge.className = 'badge-registrada';
    badge.style.marginLeft = '8px';
    badge.textContent = prellenado.estado === 'Completo' ? 'Guardado · Completo' : 'Guardado · Borrador';
    nodo.querySelector('.sede-head .titulo').appendChild(badge);
  } else {
    refrescarSedesDeInstitucion(institucionNodo);
    selSede.addEventListener('change', () => {
      refrescarSedesDeInstitucion(institucionNodo);
      guardarBorrador();
    });
  }

  chipsWrap.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.chip');
    if (!btn) return;
    chipsWrap.querySelectorAll('.chip').forEach((c) => c.classList.remove('activo'));
    btn.classList.add('activo');
    chipsWrap.dataset.valor = btn.dataset.nivel;
    guardarBorrador();
  });

  descripcion.addEventListener('input', debounce(guardarBorrador, 400));

  fotosInput.addEventListener('change', () => {
    Array.from(fotosInput.files).forEach((file) => agregarArchivo(nodo, 'foto', file, fotosLista));
    fotosInput.value = '';
    actualizarEstadoBotonEnviar();
  });

  videosInput.addEventListener('change', () => {
    Array.from(videosInput.files).forEach((file) => agregarArchivo(nodo, 'video', file, videosLista));
    videosInput.value = '';
    actualizarEstadoBotonEnviar();
  });

  documentosInput.addEventListener('change', () => {
    Array.from(documentosInput.files).forEach((file) => agregarArchivo(nodo, 'documento', file, documentosLista));
    documentosInput.value = '';
    actualizarEstadoBotonEnviar();
  });

  btnQuitarSede.addEventListener('click', () => {
    nodo.remove();
    refrescarSedesDeInstitucion(institucionNodo);
    actualizarEstadoBotonEnviar();
    guardarBorrador();
  });

  actualizarEstadoBotonEnviar();
  if (!prellenado) guardarBorrador();
  return nodo;
}

// Repuebla los <select> de sede de TODAS las sedes ya agregadas dentro de una
// institución (excluye los bloques en modo edición, que tienen su sede fija).
function refrescarSedesDeInstitucion(institucionNodo) {
  const municipio = institucionNodo.querySelector('[data-role="municipio"]').value;
  const institucion = institucionNodo.querySelector('[data-role="institucion"]').value;
  if (!municipio || !institucion) return;

  const sedesDisponibles = ((catalogos.geo[municipio] || {})[institucion] || []).slice().sort();
  const selects = Array.from(institucionNodo.querySelectorAll('[data-role="sede"]:not(:disabled)'));
  const elegidasLocalmente = new Set(selects.map((s) => s.value).filter(Boolean));

  selects.forEach((select) => {
    const valorActual = select.value;
    select.innerHTML = '<option value="">— Selecciona la sede —</option>';

    sedesDisponibles.forEach((sede) => {
      const clave = claveSede(municipio, institucion, sede);
      const opt = new Option(sede, sede);

      if (registradasSet.has(clave)) {
        opt.disabled = true;
        opt.textContent = sede + ' (ya registrada)';
      } else if (elegidasLocalmente.has(sede) && sede !== valorActual) {
        opt.disabled = true;
        opt.textContent = sede + ' (ya agregada)';
      }
      select.appendChild(opt);
    });

    if (valorActual) select.value = valorActual;
  });
}

// ─── Adjuntos ────────────────────────────────────────────────

// tipo ('foto' | 'video' | 'documento') → clave del array en _archivos / ícono del sprite.
function claveArchivos(tipo) {
  if (tipo === 'foto') return 'fotos';
  if (tipo === 'video') return 'videos';
  return 'documentos';
}
function iconoParaTipo(tipo) {
  if (tipo === 'foto') return '#icono-camara';
  if (tipo === 'video') return '#icono-video';
  return '#icono-documento';
}
function etiquetaTipo(tipo) {
  if (tipo === 'foto') return 'Foto';
  if (tipo === 'video') return 'Video';
  return 'Documento';
}

function agregarArchivo(sedeNodo, tipo, file, contenedorLista) {
  sedeNodo._archivos[claveArchivos(tipo)].push(file);

  const tpl = document.getElementById('plantillaArchivo');
  const item = tpl.content.firstElementChild.cloneNode(true);
  item.querySelector('[data-role="nombre"]').textContent = file.name;
  item.querySelector('[data-role="peso"]').textContent = formatearPeso(file.size);

  if (tipo === 'foto') {
    const img = item.querySelector('[data-role="miniatura"]');
    img.src = URL.createObjectURL(file);
    img.classList.remove('oculto');
  } else {
    const icono = item.querySelector('[data-role="icono-video"]');
    icono.querySelector('[data-role="icono-tipo"] use').setAttribute('href', iconoParaTipo(tipo));
    icono.classList.remove('oculto');
  }

  item.querySelector('[data-role="quitar-archivo"]').addEventListener('click', () => {
    const lista = sedeNodo._archivos[claveArchivos(tipo)];
    const idx = lista.indexOf(file);
    if (idx !== -1) lista.splice(idx, 1);
    item.remove();
    actualizarEstadoBotonEnviar();
  });

  contenedorLista.appendChild(item);
}

// El backend guarda solo {nombre, url, tipo} en filas viejas — el id de
// Drive se extrae de la URL si no vino ya como campo aparte.
function idDriveDeEvidencia_(ev) {
  if (ev.id) return ev.id;
  const m = /\/d\/([^/]+)/.exec(ev.url || '');
  return m ? m[1] : '';
}

// Muestra las evidencias que ya estaban subidas al servidor (modo edición):
// miniatura clicable (abre previsualización grande) en vez de solo un
// enlace de texto, sin barra de progreso.
function renderArchivosExistentes(sedeNodo, fotosLista, videosLista, documentosLista) {
  fotosLista.innerHTML = '';
  videosLista.innerHTML = '';
  documentosLista.innerHTML = '';

  sedeNodo._archivosExistentes.forEach((ev) => {
    const contenedor = ev.tipo === 'foto' ? fotosLista : ev.tipo === 'video' ? videosLista : documentosLista;
    const tpl = document.getElementById('plantillaArchivo');
    const item = tpl.content.firstElementChild.cloneNode(true);
    const id = idDriveDeEvidencia_(ev);

    item.querySelector('[data-role="nombre"]').textContent = ev.nombre;
    item.querySelector('[data-role="peso"]').textContent = 'Ya subido';

    if (id && (ev.tipo === 'foto' || ev.tipo === 'video')) {
      const img = item.querySelector('[data-role="miniatura"]');
      img.src = `https://drive.google.com/thumbnail?id=${id}&sz=w200`;
      img.classList.remove('oculto');
      img.addEventListener('error', () => {
        img.classList.add('oculto');
        const icono = item.querySelector('[data-role="icono-video"]');
        icono.querySelector('[data-role="icono-tipo"] use').setAttribute('href', iconoParaTipo(ev.tipo));
        icono.classList.remove('oculto');
      }, { once: true });
      if (ev.tipo === 'video') {
        const play = document.createElement('div');
        play.className = 'miniatura-play';
        play.innerHTML = iconoSvg('icono-video');
        img.insertAdjacentElement('afterend', play);
      }
    } else {
      const icono = item.querySelector('[data-role="icono-video"]');
      icono.querySelector('[data-role="icono-tipo"] use').setAttribute('href', iconoParaTipo(ev.tipo));
      icono.classList.remove('oculto');
    }

    if (id) {
      item.classList.add('previsualizable');
      item.addEventListener('click', () => abrirPrevia(ev, id));
    }

    item.querySelector('[data-role="quitar-archivo"]').addEventListener('click', (ev2) => {
      ev2.stopPropagation();
      const idx = sedeNodo._archivosExistentes.indexOf(ev);
      if (idx !== -1) sedeNodo._archivosExistentes.splice(idx, 1);
      item.remove();
    });

    contenedor.appendChild(item);
  });
}

// ─── Modal de previsualización ───────────────────────────────
// Documentos, fotos y videos se muestran igual: el visor embebido de Drive
// (/preview) renderiza el contenido real de los tres — para un documento
// eso significa abrir el documento, no solo un ícono.

function abrirPrevia(ev, id) {
  const modal = document.getElementById('modalPrevia');
  const cuerpo = modal.querySelector('[data-role="modal-cuerpo"]');
  const enlaceAbrir = modal.querySelector('[data-role="modal-abrir"]');

  modal.querySelector('[data-role="modal-nombre"]').textContent = ev.nombre;
  modal.querySelector('[data-role="modal-tipo"]').innerHTML = `${iconoSvg(iconoParaTipo(ev.tipo).slice(1))} ${etiquetaTipo(ev.tipo)}`;
  enlaceAbrir.href = ev.url || `https://drive.google.com/file/d/${id}/view`;
  cuerpo.innerHTML = `<iframe src="https://drive.google.com/file/d/${id}/preview" allow="autoplay" allowfullscreen></iframe>`;

  modal.classList.remove('oculto');
}

function cerrarPrevia() {
  const modal = document.getElementById('modalPrevia');
  modal.classList.add('oculto');
  modal.querySelector('[data-role="modal-cuerpo"]').innerHTML = ''; // corta video/audio en reproducción
}

// ─── Mis reportes (recuperar/editar lo ya guardado) ─────────

async function cargarMisReportes() {
  const seccion = document.getElementById('misReportes');
  const lista = document.getElementById('misReportesLista');

  if (!elPadrino.value) {
    seccion.classList.add('oculto');
    return;
  }

  try {
    const url = `${CONFIG.GAS_URL}?accion=misRegistros&padrino=${encodeURIComponent(elPadrino.value)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);

    const registros = json.data || [];
    lista.innerHTML = '';

    if (registros.length === 0) {
      seccion.classList.add('oculto');
      return;
    }

    registros.forEach((r) => {
      const tpl = document.getElementById('plantillaReporteGuardado');
      const item = tpl.content.firstElementChild.cloneNode(true);
      item.querySelector('[data-role="texto"]').textContent = `${r.institucion} — ${r.sede} (${r.municipio})`;

      const badge = item.querySelector('[data-role="badge"]');
      badge.textContent = r.estado || 'Borrador';
      badge.style.background = r.estado === 'Completo' ? 'var(--safe-border)' : 'var(--caution-border)';
      badge.style.color = r.estado === 'Completo' ? 'var(--safe-ink)' : 'var(--caution-ink)';

      item.querySelector('[data-role="editar"]').addEventListener('click', () => cargarRegistroParaEditar(r));
      lista.appendChild(item);
    });

    seccion.classList.remove('oculto');
  } catch (err) {
    seccion.classList.add('oculto');
  }
}

function cargarRegistroParaEditar(r) {
  const nodo = agregarInstitucion({
    municipio: r.municipio,
    institucion: r.institucion,
    rectorNombre: r.rectorNombre,
    rectorCorreo: r.rectorCorreo,
    rectorTelefono: r.rectorTelefono,
  });

  agregarSede(nodo, {
    sede: r.sede,
    nivel: r.nivel,
    descripcion: r.descripcion,
    evidencias: r.evidencias || [],
    numeroFila: r.numeroFila,
    estado: r.estado,
  });

  actualizarEstadoBotonEnviar();
  nodo.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ─── Borrador local (localStorage) ──────────────────────────
// Solo texto y selecciones de bloques NUEVOS (los que vienen de "Mis
// reportes" no se vuelven a guardar aquí — ya están en el servidor). Los
// archivos no se pueden serializar y se pierden al recargar.

function serializarFormulario() {
  const instituciones = Array.from(document.querySelectorAll('[data-institucion-bloque]'))
    .filter((instEl) => !instEl.querySelector('[data-role="municipio"]').disabled)
    .map((instEl) => ({
      municipio: instEl.querySelector('[data-role="municipio"]').value,
      institucion: instEl.querySelector('[data-role="institucion"]').value,
      rectorNombre: instEl.querySelector('[data-role="rector-nombre"]').value,
      rectorCorreo: instEl.querySelector('[data-role="rector-correo"]').value,
      rectorTelefono: instEl.querySelector('[data-role="rector-telefono"]').value,
      sedes: Array.from(instEl.querySelectorAll('[data-sede-bloque]'))
        .filter((sedeEl) => !sedeEl.querySelector('[data-role="sede"]').disabled)
        .map((sedeEl) => ({
          sede: sedeEl.querySelector('[data-role="sede"]').value,
          nivel: sedeEl.querySelector('[data-role="nivel-chips"]').dataset.valor,
          descripcion: sedeEl.querySelector('[data-role="descripcion"]').value,
        })),
    }));

  return {
    padrino: elPadrino.value,
    padrinoCorreo: elPadrinoCorreo.value,
    padrinoTelefono: elPadrinoTelefono.value,
    instituciones,
  };
}

function guardarBorrador() {
  try {
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(serializarFormulario()));
  } catch (e) {
    // almacenamiento lleno o no disponible: se ignora, no es crítico
  }
}

function restaurarBorrador() {
  let datos;
  try {
    const raw = localStorage.getItem(CLAVE_BORRADOR);
    if (!raw) return;
    datos = JSON.parse(raw);
  } catch (e) {
    return;
  }
  if (!datos) return;

  if (datos.padrino) elPadrino.value = datos.padrino;
  if (datos.padrinoCorreo) elPadrinoCorreo.value = datos.padrinoCorreo;
  if (datos.padrinoTelefono) elPadrinoTelefono.value = datos.padrinoTelefono;

  let huboSedes = false;

  (datos.instituciones || []).forEach((instDatos) => {
    const nodo = agregarInstitucion();
    const selMunicipio = nodo.querySelector('[data-role="municipio"]');
    const selInstitucion = nodo.querySelector('[data-role="institucion"]');

    if (instDatos.municipio) {
      selMunicipio.value = instDatos.municipio;
      selMunicipio.dispatchEvent(new Event('change'));
    }
    if (instDatos.institucion) {
      selInstitucion.value = instDatos.institucion;
      selInstitucion.dispatchEvent(new Event('change'));
    }
    nodo.querySelector('[data-role="rector-nombre"]').value = instDatos.rectorNombre || '';
    nodo.querySelector('[data-role="rector-correo"]').value = instDatos.rectorCorreo || '';
    nodo.querySelector('[data-role="rector-telefono"]').value = instDatos.rectorTelefono || '';

    (instDatos.sedes || []).forEach((sedeDatos) => {
      huboSedes = true;
      agregarSede(nodo);
      const sedeNodo = nodo.querySelector('[data-role="sedes-lista"]').lastElementChild;
      const selSede = sedeNodo.querySelector('[data-role="sede"]');

      if (sedeDatos.sede) {
        selSede.value = sedeDatos.sede;
        selSede.dispatchEvent(new Event('change'));
      }
      if (sedeDatos.nivel) {
        const chip = sedeNodo.querySelector(`.chip[data-nivel="${sedeDatos.nivel}"]`);
        if (chip) chip.click();
      }
      sedeNodo.querySelector('[data-role="descripcion"]').value = sedeDatos.descripcion || '';
    });
  });

  if (huboSedes) document.getElementById('avisoBorrador').classList.remove('oculto');
}

// ─── Validación ──────────────────────────────────────────────
// Solo se exige lo necesario para identificar la sede y a quién contactar.
// Nivel, descripción y evidencia son opcionales: se puede enviar incompleto
// y completarlo después desde "Mis reportes".

function validarFormulario() {
  if (!elPadrino.value) return 'Selecciona tu nombre de padrino.';

  // El correo solo es obligatorio si el catálogo ya tenía uno para este
  // padrino — algunos (por ahora) todavía no tienen correo registrado.
  const registroPadrino = catalogos.padrinos.find((p) => p.nombre === elPadrino.value);
  const correoEsperado = !registroPadrino || registroPadrino.correo;
  if (correoEsperado && !elPadrinoCorreo.value.trim()) return 'Falta tu correo electrónico.';
  if (!elPadrinoTelefono.value.trim()) return 'Falta tu teléfono de contacto.';

  const bloquesInst = document.querySelectorAll('[data-institucion-bloque]');
  if (bloquesInst.length === 0) return 'Agrega al menos una institución.';

  for (const instEl of bloquesInst) {
    const municipio = instEl.querySelector('[data-role="municipio"]').value;
    const institucion = instEl.querySelector('[data-role="institucion"]').value;
    if (!municipio) return 'Falta elegir un municipio en una de las instituciones agregadas.';
    if (!institucion) return 'Falta elegir la institución educativa en ' + municipio + '.';

    const rectorNombre = instEl.querySelector('[data-role="rector-nombre"]').value.trim();
    const rectorCorreo = instEl.querySelector('[data-role="rector-correo"]').value.trim();
    const rectorTelefono = instEl.querySelector('[data-role="rector-telefono"]').value.trim();
    if (!rectorNombre || !rectorCorreo || !rectorTelefono) {
      return 'Completa los datos de contacto del rector de ' + institucion + '.';
    }

    const bloquesSede = instEl.querySelectorAll('[data-sede-bloque]');
    if (bloquesSede.length === 0) return 'Agrega al menos una sede en ' + institucion + '.';

    for (const sedeEl of bloquesSede) {
      const sede = sedeEl.querySelector('[data-role="sede"]').value;
      if (!sede) return 'Falta elegir la sede de una de las sedes agregadas en ' + institucion + '.';
    }
  }
  return null;
}

function sedeNodoArchivos(sedeEl) {
  return sedeEl._archivos || { fotos: [], videos: [], documentos: [] };
}

// ─── Recolección del payload ─────────────────────────────────

function recolectarSedes() {
  const sedes = [];
  const padrino = {
    nombre: elPadrino.value,
    correo: elPadrinoCorreo.value.trim(),
    telefono: elPadrinoTelefono.value.trim(),
  };

  document.querySelectorAll('[data-institucion-bloque]').forEach((instEl) => {
    const municipio = instEl.querySelector('[data-role="municipio"]').value;
    const institucion = instEl.querySelector('[data-role="institucion"]').value;
    const rector = {
      nombre: instEl.querySelector('[data-role="rector-nombre"]').value.trim(),
      correo: instEl.querySelector('[data-role="rector-correo"]').value.trim(),
      telefono: instEl.querySelector('[data-role="rector-telefono"]').value.trim(),
    };

    instEl.querySelectorAll('[data-sede-bloque]').forEach((sedeEl) => {
      sedes.push({
        padrino,
        municipio,
        institucion,
        rector,
        sede: sedeEl.querySelector('[data-role="sede"]').value,
        nivel: sedeEl.querySelector('[data-role="nivel-chips"]').dataset.valor,
        descripcion: sedeEl.querySelector('[data-role="descripcion"]').value.trim(),
        archivos: sedeNodoArchivos(sedeEl),
        archivosExistentes: sedeEl._archivosExistentes || [],
      });
    });
  });

  return sedes;
}

// ─── Envío secuencial (sede por sede) ───────────────────────
// Si una sede falla, las anteriores ya quedaron guardadas: el resultado
// final permite reintentar solo las que fallaron.

async function procesarSede(info, onProgreso) {
  const ini = await postGAS({
    accion: 'iniciarSede',
    municipio: info.municipio,
    institucion: info.institucion,
    sede: info.sede,
    padrino: info.padrino.nombre,
  });

  const evidencias = info.archivosExistentes.slice();
  const totalArchivos = info.archivos.fotos.length + info.archivos.videos.length + info.archivos.documentos.length;
  let procesados = 0;
  let indiceFoto = 1;
  let indiceVideo = 1;
  let indiceDocumento = 1;

  for (const file of info.archivos.fotos) {
    const nombreBase = construirNombreBase(info.municipio, info.institucion, info.sede, 'foto', indiceFoto++);
    const resultado = await subirArchivo(file, ini.data.carpetaSedeId, 'foto', nombreBase, (frac) => {
      onProgreso(`Subiendo ${nombreBase}… ${Math.round(frac * 100)}%`);
    });
    procesados++;
    evidencias.push(resultado);
    onProgreso(`${procesados}/${totalArchivos} archivos nuevos subidos`);
  }

  for (const file of info.archivos.videos) {
    const nombreBase = construirNombreBase(info.municipio, info.institucion, info.sede, 'video', indiceVideo++);
    const resultado = await subirArchivo(file, ini.data.carpetaSedeId, 'video', nombreBase, (frac) => {
      onProgreso(`Subiendo ${nombreBase}… ${Math.round(frac * 100)}%`);
    });
    procesados++;
    evidencias.push(resultado);
    onProgreso(`${procesados}/${totalArchivos} archivos nuevos subidos`);
  }

  for (const file of info.archivos.documentos) {
    const nombreBase = construirNombreBase(info.municipio, info.institucion, info.sede, 'documento', indiceDocumento++);
    const resultado = await subirArchivo(file, ini.data.carpetaSedeId, 'documento', nombreBase, (frac) => {
      onProgreso(`Subiendo ${nombreBase}… ${Math.round(frac * 100)}%`);
    });
    procesados++;
    evidencias.push(resultado);
    onProgreso(`${procesados}/${totalArchivos} archivos nuevos subidos`);
  }

  await postGAS({
    accion: 'guardarSede',
    padrino: info.padrino,
    municipio: info.municipio,
    institucion: info.institucion,
    rector: info.rector,
    sede: info.sede,
    nivel: info.nivel,
    descripcion: info.descripcion,
    carpetaSedeId: ini.data.carpetaSedeId,
    urlSede: ini.data.urlSede,
    evidencias,
  });
}

async function enviarSedes(sedes) {
  document.getElementById('formulario').classList.add('oculto');
  document.getElementById('pantallaResultado').classList.add('oculto');
  const pantallaEnvio = document.getElementById('pantallaEnvio');
  pantallaEnvio.classList.remove('oculto');

  const listaProgreso = document.getElementById('listaProgresoSedes');
  const detalle = document.getElementById('detalleEnvio');
  const barraRelleno = document.getElementById('barraGlobalRelleno');
  listaProgreso.innerHTML = '';

  const filas = sedes.map((info) => {
    const fila = document.createElement('div');
    fila.className = 'progreso-sede-item';
    fila.innerHTML = `<span class="estado-icono">${estadoIconoMarkup('pendiente')}</span><span class="nombre">${info.institucion} — ${info.sede}</span>`;
    listaProgreso.appendChild(fila);
    return fila;
  });

  const exitosas = [];
  const fallidas = [];

  for (let i = 0; i < sedes.length; i++) {
    const info = sedes[i];
    const fila = filas[i];
    fila.classList.add('activo');
    fila.querySelector('.estado-icono').innerHTML = estadoIconoMarkup('activo');
    detalle.textContent = `Sede ${i + 1} de ${sedes.length} · ${info.institucion} — ${info.sede}`;

    try {
      await procesarSede(info, (texto) => {
        detalle.textContent = `Sede ${i + 1} de ${sedes.length} · ${texto}`;
      });
      fila.classList.remove('activo');
      fila.classList.add('ok');
      fila.querySelector('.estado-icono').innerHTML = estadoIconoMarkup('ok');
      exitosas.push(info);
      registradasSet.add(claveSede(info.municipio, info.institucion, info.sede));
    } catch (err) {
      fila.classList.remove('activo');
      fila.classList.add('error');
      fila.querySelector('.estado-icono').innerHTML = estadoIconoMarkup('error');
      const mensaje = err.message || 'Error desconocido';
      info._errorMsg = mensaje;
      const detalle = document.createElement('div');
      detalle.className = 'detalle-error';
      detalle.textContent = mensaje;
      fila.appendChild(detalle);
      fallidas.push(info);
    }

    barraRelleno.style.transform = `scaleX(${(i + 1) / sedes.length})`;
  }

  mostrarResultado(exitosas, fallidas);
}

function mostrarResultado(exitosas, fallidas) {
  document.getElementById('pantallaEnvio').classList.add('oculto');
  document.getElementById('pantallaResultado').classList.remove('oculto');

  const icono = document.getElementById('resultadoIcono');
  const titulo = document.getElementById('resultadoTitulo');
  const detalle = document.getElementById('resultadoDetalle');
  const lista = document.getElementById('listaResultadoSedes');
  const btnReintentar = document.getElementById('btnReintentarFallidas');

  lista.innerHTML = '';
  exitosas.forEach((info) => {
    const fila = document.createElement('div');
    fila.className = 'progreso-sede-item ok';
    fila.innerHTML = `<span class="estado-icono">${estadoIconoMarkup('ok')}</span><span class="nombre">${info.institucion} — ${info.sede}</span>`;
    lista.appendChild(fila);
  });
  fallidas.forEach((info) => {
    const fila = document.createElement('div');
    fila.className = 'progreso-sede-item error';
    fila.innerHTML = `<span class="estado-icono">${estadoIconoMarkup('error')}</span><span class="nombre">${info.institucion} — ${info.sede}</span>`;
    if (info._errorMsg) {
      const detalle = document.createElement('div');
      detalle.className = 'detalle-error';
      detalle.textContent = info._errorMsg;
      fila.appendChild(detalle);
    }
    lista.appendChild(fila);
  });

  const iconoExito = `<svg viewBox="0 0 40 40"><circle class="anillo-exito" cx="20" cy="20" r="17"/><path class="marca-exito" d="M13 20.5l4.8 4.8L27.5 14.5"/></svg>`;
  const iconoAlerta = `<svg viewBox="0 0 40 40"><path class="anillo-alerta" d="M20 5 36 33H4Z" stroke-linejoin="round"/><path class="marca-alerta" d="M20 16v8"/><circle class="marca-alerta" cx="20" cy="27" r="1" fill="currentColor"/></svg>`;

  if (fallidas.length === 0) {
    icono.innerHTML = iconoExito;
    titulo.textContent = '¡Reporte guardado!';
    detalle.textContent = `Se guardaron ${exitosas.length} sede(s). Las que quedaron incompletas puedes terminarlas después desde "Tus reportes guardados".`;
    btnReintentar.classList.add('oculto');
    try { localStorage.removeItem(CLAVE_BORRADOR); } catch (e) {}
  } else if (exitosas.length === 0) {
    icono.innerHTML = iconoAlerta;
    titulo.textContent = 'No se pudo guardar el reporte';
    detalle.textContent = `Fallaron ${fallidas.length} sede(s). Revisa tu conexión e intenta de nuevo.`;
    btnReintentar.classList.remove('oculto');
  } else {
    icono.innerHTML = iconoAlerta;
    titulo.textContent = 'Reporte guardado parcialmente';
    detalle.textContent = `${exitosas.length} sede(s) guardadas, ${fallidas.length} fallaron.`;
    btnReintentar.classList.remove('oculto');
  }

  window._sedesFallidas = fallidas;
}

// ─── Estado del botón Enviar ─────────────────────────────────

function actualizarEstadoBotonEnviar() {
  document.getElementById('btnEnviar').disabled = document.querySelectorAll('[data-sede-bloque]').length === 0;
}

// ─── Inicialización ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  elPadrino = document.getElementById('padrino');
  elPadrinoCorreo = document.getElementById('padrinoCorreo');
  elPadrinoTelefono = document.getElementById('padrinoTelefono');

  elPadrino.addEventListener('change', () => {
    const p = catalogos.padrinos.find((x) => x.nombre === elPadrino.value);
    if (p) {
      elPadrinoCorreo.value = p.correo;
      elPadrinoTelefono.value = p.telefono;
    }
    guardarBorrador();
    cargarMisReportes();
  });
  elPadrinoCorreo.addEventListener('input', debounce(guardarBorrador, 400));
  elPadrinoTelefono.addEventListener('input', debounce(guardarBorrador, 400));

  document.getElementById('btnAgregarInstitucion').addEventListener('click', () => agregarInstitucion());

  document.getElementById('btnEnviar').addEventListener('click', () => {
    const error = validarFormulario();
    const banner = document.getElementById('mensajeError');
    if (error) {
      banner.querySelector('[data-role="texto"]').textContent = error;
      banner.classList.remove('oculto');
      banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    banner.classList.add('oculto');

    const sedes = recolectarSedes();
    // Aviso explícito si alguna sede se va a enviar sin ninguna evidencia —
    // para no depender de que el padrino se dé cuenta solo, mirando la
    // lista de archivos adjuntos.
    const sinEvidencia = sedes.filter((s) => {
      const nuevas = s.archivos.fotos.length + s.archivos.videos.length + s.archivos.documentos.length;
      return nuevas + s.archivosExistentes.length === 0;
    });
    if (sinEvidencia.length > 0) {
      const lista = sinEvidencia.map((s) => `• ${s.institucion} — ${s.sede}`).join('\n');
      const confirmado = window.confirm(
        `${sinEvidencia.length} sede(s) no tienen ninguna foto, video o documento adjunto:\n\n${lista}\n\n` +
        'Se guardarán como Borrador, sin evidencia. ¿Enviar de todas formas?'
      );
      if (!confirmado) return;
    }

    enviarSedes(sedes);
  });

  document.getElementById('btnReintentarFallidas').addEventListener('click', () => {
    const fallidas = window._sedesFallidas || [];
    if (fallidas.length === 0) return;
    enviarSedes(fallidas);
  });

  document.getElementById('btnNuevoReporte').addEventListener('click', () => location.reload());

  document.querySelectorAll('[data-role="modal-cerrar"]').forEach((el) => {
    el.addEventListener('click', cerrarPrevia);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') cerrarPrevia();
  });

  cargarCatalogos();
});
