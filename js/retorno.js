// ================================================
// Retorno a clases — lógica del formulario pequeño (retorno.html)
// Trae solo las sedes que ya tienen reporte (accion=sedesRetorno). Se pueden
// marcar varias sedes de una institución, elegir el retorno que aplica a ese
// grupo y agregarlas a una lista; se repite con otras instituciones/opciones y
// al final se envía todo junto (accion=guardarRetornos). Una sede que ya se
// envió, o que ya está en la lista, no se puede volver a seleccionar.
// ================================================

const MAX_OBSERVACIONES = 1000;

let arbol = {}; // municipio → institución → [item]; item = { municipio, institucion, sede, retorno, retornoObs }
let cola = []; // sedes por enviar: { ref: item, retorno, observaciones }
const marcadas = new Set(); // nombres de sede marcadas en la institución elegida
let retornoElegido = '';

let elMunicipio, elInstitucion, elSedesLista, elObservaciones, elBtnAgregar, elBtnGuardar, elBtnTodas;

// ─── Utilidades ──────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

function escaparHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s == null ? '' : s);
  return d.innerHTML;
}

function ordenarEs(lista) {
  return lista.sort((a, b) => a.localeCompare(b, 'es'));
}

function plural(n, singular, pluralTxt) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
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

function mostrarError(mensaje) {
  const banner = $('mensajeError');
  if (mensaje) $('mensajeOk').classList.add('oculto');
  banner.classList.toggle('oculto', !mensaje);
  if (!mensaje) return;
  banner.querySelector('[data-role="texto"]').textContent = mensaje;
  banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function mostrarOk(mensaje) {
  const banner = $('mensajeOk');
  banner.classList.toggle('oculto', !mensaje);
  if (mensaje) banner.querySelector('[data-role="texto"]').textContent = mensaje;
}

// ─── Estado de cada sede ─────────────────────────────────────
// Una sede es seleccionable solo si no se ha enviado (retorno ya guardado,
// sea de esta sesión o de antes) y no está esperando en la lista.

const yaEnviada = (item) => !!item.retorno;
const enLista = (item) => cola.some((c) => c.ref === item);
const disponible = (item) => !yaEnviada(item) && !enLista(item);

function disponiblesDeInstitucion(municipio, institucion) {
  return arbol[municipio][institucion].filter(disponible).length;
}

function disponiblesDeMunicipio(municipio) {
  return Object.keys(arbol[municipio]).reduce((acc, ie) => acc + disponiblesDeInstitucion(municipio, ie), 0);
}

function etiquetaDisponibles(nombre, n) {
  return n > 0 ? `${nombre} · ${plural(n, 'disponible', 'disponibles')}` : `${nombre} · completo`;
}

// ─── Carga inicial ───────────────────────────────────────────

async function cargarSedes() {
  try {
    const res = await fetch(`${CONFIG.GAS_URL}?accion=sedesRetorno`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);

    arbol = {};
    json.data.forEach((s) => {
      if (!arbol[s.municipio]) arbol[s.municipio] = {};
      if (!arbol[s.municipio][s.institucion]) arbol[s.municipio][s.institucion] = [];
      arbol[s.municipio][s.institucion].push(s);
    });

    refrescarTodo();
    $('cargandoSedes').classList.add('oculto');
    $('formulario').classList.remove('oculto');
  } catch (err) {
    $('cargandoSedes').classList.add('oculto');
    $('errorSedes').classList.remove('oculto');
  }
}

// ─── Cascada Municipio → Institución → Sedes ─────────────────
// Se reconstruye entera cada vez que cambia el estado (agregar, quitar,
// guardar): los conteos de "disponibles" y las sedes bloqueadas dependen de él.

function poblarMunicipios() {
  const actual = elMunicipio.value;
  elMunicipio.innerHTML = '<option value="">— Selecciona un municipio —</option>';
  ordenarEs(Object.keys(arbol)).forEach((m) => {
    const n = disponiblesDeMunicipio(m);
    const opcion = new Option(etiquetaDisponibles(m, n), m);
    opcion.disabled = n === 0;
    elMunicipio.add(opcion);
  });
  elMunicipio.value = actual;
}

function poblarInstituciones() {
  const municipio = elMunicipio.value;
  const actual = elInstitucion.value;
  elInstitucion.innerHTML = `<option value="">${municipio ? '— Selecciona la institución —' : '— Primero elige el municipio —'}</option>`;
  elInstitucion.disabled = !municipio;
  if (!municipio) return;
  ordenarEs(Object.keys(arbol[municipio])).forEach((ie) => {
    const n = disponiblesDeInstitucion(municipio, ie);
    const opcion = new Option(etiquetaDisponibles(ie, n), ie);
    opcion.disabled = n === 0;
    elInstitucion.add(opcion);
  });
  elInstitucion.value = actual;
}

function sedesDeLaInstitucion() {
  const municipio = elMunicipio.value;
  const institucion = elInstitucion.value;
  if (!municipio || !institucion || !arbol[municipio] || !arbol[municipio][institucion]) return [];
  return arbol[municipio][institucion].slice().sort((a, b) => a.sede.localeCompare(b.sede, 'es'));
}

function renderSedes() {
  const items = sedesDeLaInstitucion();
  if (!items.length) {
    elSedesLista.innerHTML = '<p class="sedes-vacio">Primero elige la institución.</p>';
    elBtnTodas.classList.add('oculto');
    return;
  }

  elSedesLista.innerHTML = items
    .map((it) => {
      const nota = yaEnviada(it) ? 'Ya enviada' : enLista(it) ? 'En la lista' : '';
      const marcada = !nota && marcadas.has(it.sede);
      return `
        <label class="sede-opcion${nota ? ' bloqueada' : ''}${marcada ? ' marcada' : ''}">
          <input type="checkbox" data-sede="${escaparHtml(it.sede)}"${nota ? ' disabled' : ''}${marcada ? ' checked' : ''} />
          <span class="sede-nombre">${escaparHtml(it.sede)}</span>
          ${nota ? `<span class="sede-nota">${nota}</span>` : ''}
        </label>`;
    })
    .join('');

  const libres = items.filter(disponible);
  elBtnTodas.classList.toggle('oculto', libres.length === 0);
  elBtnTodas.textContent = libres.every((it) => marcadas.has(it.sede)) ? 'Quitar selección' : 'Seleccionar todas';
}

// Sincroniza `marcadas` con lo que hay en pantalla y muestra/oculta el paso
// siguiente (retorno + observaciones).
function alCambiarMarcadas() {
  marcadas.clear();
  elSedesLista.querySelectorAll('input[type="checkbox"]:checked').forEach((c) => marcadas.add(c.dataset.sede));
  elSedesLista.querySelectorAll('.sede-opcion').forEach((l) => l.classList.toggle('marcada', !!l.querySelector('input:checked')));
  mostrarOk('');
  actualizarPasoRetorno();
}

function actualizarPasoRetorno() {
  $('cardRetorno').classList.toggle('oculto', marcadas.size === 0);
  $('ayudaAgregar').textContent = marcadas.size
    ? `Se aplicará a ${plural(marcadas.size, 'sede marcada', 'sedes marcadas')} de ${elInstitucion.value}.`
    : '';
  elBtnAgregar.disabled = !(marcadas.size && retornoElegido);
}

// ─── Opciones de retorno ─────────────────────────────────────

function renderOpciones() {
  const cont = $('opcionesRetorno');
  cont.innerHTML = RETORNO_OPCIONES.map(
    (o) => `
      <label class="retorno-opcion" data-retorno="${o.clave}">
        <input type="radio" name="retorno" value="${escaparHtml(o.valor)}" />
        <span>${escaparHtml(o.valor)}</span>
      </label>`
  ).join('');

  cont.querySelectorAll('input[name="retorno"]').forEach((input) => {
    input.addEventListener('change', () => {
      elegirRetorno(input.value);
      actualizarPasoRetorno();
    });
  });
}

function elegirRetorno(valor) {
  retornoElegido = valor;
  document.querySelectorAll('#opcionesRetorno .retorno-opcion').forEach((label) => {
    const input = label.querySelector('input');
    input.checked = input.value === valor;
    label.classList.toggle('elegida', input.checked);
  });
}

function actualizarContador() {
  $('contadorObs').textContent = `${elObservaciones.value.length} / ${MAX_OBSERVACIONES}`;
}

// ─── Lista por enviar (resumen) ──────────────────────────────

// Agrupa por Municipio → Institución y, dentro, por (retorno + observaciones):
// diez sedes con la misma respuesta salen como un solo bloque con diez chips,
// no diez filas repetidas. `entradas` = [{ municipio, institucion, sede,
// retorno, observaciones, idx }]; `idx` (posición en `cola`) solo se usa para
// el botón de quitar.
function listaHtml(entradas, conQuitar) {
  const porInstitucion = new Map();
  entradas.forEach((e) => {
    const clave = `${e.municipio}|${e.institucion}`;
    if (!porInstitucion.has(clave)) porInstitucion.set(clave, { municipio: e.municipio, institucion: e.institucion, entradas: [] });
    porInstitucion.get(clave).entradas.push(e);
  });

  const instituciones = [...porInstitucion.values()].sort(
    (a, b) => a.municipio.localeCompare(b.municipio, 'es') || a.institucion.localeCompare(b.institucion, 'es')
  );

  return instituciones
    .map((g) => {
      const lotes = new Map();
      g.entradas.forEach((e) => {
        const clave = `${e.retorno}|${e.observaciones}`;
        if (!lotes.has(clave)) lotes.set(clave, { retorno: e.retorno, observaciones: e.observaciones, entradas: [] });
        lotes.get(clave).entradas.push(e);
      });
      const ordenRetorno = (v) => RETORNO_OPCIONES.findIndex((o) => o.valor === v);
      const lotesHtml = [...lotes.values()]
        .sort((a, b) => ordenRetorno(a.retorno) - ordenRetorno(b.retorno))
        .map((l) => {
          const opcion = RETORNO_OPCIONES.find((o) => o.valor === l.retorno);
          const chips = l.entradas
            .sort((a, b) => a.sede.localeCompare(b.sede, 'es'))
            .map(
              (e) => `<span class="res-sede">${escaparHtml(e.sede)}${
                conQuitar
                  ? `<button type="button" class="res-quitar" data-quitar="${e.idx}" aria-label="Quitar ${escaparHtml(e.sede)}" title="Quitar"><svg class="icono-svg" aria-hidden="true"><use href="#icono-x"/></svg></button>`
                  : ''
              }</span>`
            )
            .join('');
          return `
            <div class="res-lote">
              <span class="placa-retorno" data-retorno="${opcion ? opcion.clave : 'sin_registro'}">${escaparHtml(l.retorno)}</span>
              ${l.observaciones ? `<p class="res-obs">${escaparHtml(l.observaciones)}</p>` : ''}
              <div class="res-sedes">${chips}</div>
            </div>`;
        })
        .join('');
      return `
        <div class="res-institucion">
          <div class="res-institucion-titulo">${escaparHtml(g.institucion)} <span>${escaparHtml(g.municipio)}</span></div>
          ${lotesHtml}
        </div>`;
    })
    .join('');
}

function entradasDeCola() {
  return cola.map((c, idx) => ({
    municipio: c.ref.municipio,
    institucion: c.ref.institucion,
    sede: c.ref.sede,
    retorno: c.retorno,
    observaciones: c.observaciones,
    idx,
  }));
}

function renderResumen() {
  const hay = cola.length > 0;
  $('cardResumen').classList.toggle('oculto', !hay);
  $('accionesEnvio').classList.toggle('oculto', !hay);
  elBtnGuardar.disabled = !hay;
  if (!hay) return;

  const instituciones = new Set(cola.map((c) => `${c.ref.municipio}|${c.ref.institucion}`)).size;
  $('resumenTitulo').textContent = `Resumen · ${plural(cola.length, 'sede', 'sedes')} de ${plural(instituciones, 'institución', 'instituciones')}`;
  $('resumenCuerpo').innerHTML = listaHtml(entradasDeCola(), true);
  elBtnGuardar.textContent = `Guardar ${plural(cola.length, 'sede', 'sedes')}`;
}

// ─── Refrescar todo ──────────────────────────────────────────

function refrescarTodo() {
  poblarMunicipios();
  poblarInstituciones();
  renderSedes();
  renderResumen();
  actualizarPasoRetorno();
}

// ─── Agregar / quitar de la lista ────────────────────────────

function agregarALista() {
  const items = sedesDeLaInstitucion().filter((it) => marcadas.has(it.sede) && disponible(it));
  if (!items.length || !retornoElegido) return;

  const observaciones = elObservaciones.value.trim();
  items.forEach((it) => cola.push({ ref: it, retorno: retornoElegido, observaciones }));

  const institucion = elInstitucion.value;
  marcadas.clear();
  elegirRetorno('');
  elObservaciones.value = '';
  actualizarContador();
  refrescarTodo();

  mostrarError('');
  mostrarOk(`Se ${items.length === 1 ? 'agregó' : 'agregaron'} ${plural(items.length, 'sede', 'sedes')} de ${institucion} a la lista.`);
  $('formulario').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function quitarDeLista(idx) {
  cola.splice(idx, 1);
  mostrarOk('');
  refrescarTodo();
}

// ─── Guardado ────────────────────────────────────────────────

async function guardar() {
  if (!cola.length) return;
  mostrarError('');
  mostrarOk('');

  const enviadas = cola.slice();
  const items = enviadas.map((c) => ({
    municipio: c.ref.municipio,
    institucion: c.ref.institucion,
    sede: c.ref.sede,
    retorno: c.retorno,
    observaciones: c.observaciones,
  }));

  $('formulario').classList.add('oculto');
  $('pantallaEnvio').classList.remove('oculto');

  let resultados;
  try {
    const json = await postGAS({ accion: 'guardarRetornos', items });
    resultados = json.data.resultados;
  } catch (err) {
    // El envío completo falló (red, backend): la lista queda intacta para reintentar.
    $('pantallaEnvio').classList.add('oculto');
    $('formulario').classList.remove('oculto');
    mostrarError(`No se pudo guardar: ${err.message || 'revisa tu conexión e intenta de nuevo.'}`);
    return;
  }

  // El backend responde sede por sede, en el mismo orden. Las guardadas y las
  // que ya tenían retorno salen de la lista (y quedan bloqueadas para siempre
  // en este formulario); las demás se quedan para reintentar.
  const guardadas = [];
  const omitidas = [];
  const problemas = [];
  enviadas.forEach((c, i) => {
    const r = resultados[i] || { estado: 'error', mensaje: 'El servidor no respondió por esta sede.' };
    const entrada = { municipio: c.ref.municipio, institucion: c.ref.institucion, sede: c.ref.sede, retorno: c.retorno, observaciones: c.observaciones };
    if (r.estado === 'ok') {
      c.ref.retorno = r.retorno;
      c.ref.retornoObs = c.observaciones;
      guardadas.push(entrada);
    } else if (r.estado === 'ya_registrada') {
      c.ref.retorno = r.retorno || 'Ya registrada';
      omitidas.push({ entrada, mensaje: `Ya tenía retorno registrado${r.retorno ? ': ' + r.retorno : ''}. No se modificó.` });
    } else {
      problemas.push({ entrada, mensaje: r.mensaje || 'No se pudo guardar.' });
    }
  });
  cola = cola.filter((c) => !c.ref.retorno);

  mostrarResultado(guardadas, omitidas, problemas);
}

function mostrarResultado(guardadas, omitidas, problemas) {
  $('pantallaEnvio').classList.add('oculto');
  $('pantallaResultado').classList.remove('oculto');

  const iconoExito = '<svg viewBox="0 0 40 40"><circle class="anillo-exito" cx="20" cy="20" r="17"/><path class="marca-exito" d="M13 20.5l4.8 4.8L27.5 14.5"/></svg>';
  const iconoAlerta = '<svg viewBox="0 0 40 40"><path class="anillo-alerta" d="M20 5 36 33H4Z" stroke-linejoin="round"/><path class="marca-alerta" d="M20 16v8"/><circle class="marca-alerta" cx="20" cy="27" r="1" fill="currentColor"/></svg>';

  const sinNovedad = omitidas.length === 0 && problemas.length === 0;
  $('resultadoIcono').innerHTML = sinNovedad ? iconoExito : iconoAlerta;

  if (sinNovedad) {
    $('resultadoTitulo').textContent = '¡Retorno a clases guardado!';
    $('resultadoDetalle').textContent = `Se guardaron ${plural(guardadas.length, 'sede', 'sedes')}.`;
  } else if (guardadas.length === 0) {
    $('resultadoTitulo').textContent = 'No se guardó ninguna sede';
    $('resultadoDetalle').textContent = 'Revisa el detalle de abajo.';
  } else {
    $('resultadoTitulo').textContent = 'Guardado parcialmente';
    $('resultadoDetalle').textContent = `Se ${guardadas.length === 1 ? 'guardó' : 'guardaron'} ${plural(guardadas.length, 'sede', 'sedes')}; el resto no se pudo guardar (ver abajo).`;
  }

  const cajaGuardadas = $('resultadoGuardadas');
  cajaGuardadas.classList.toggle('oculto', guardadas.length === 0);
  cajaGuardadas.innerHTML = listaHtml(guardadas, false);

  $('resultadoProblemas').innerHTML = [
    ...problemas.map((p) => ({ ...p, clase: 'error', icono: 'icono-alerta' })),
    ...omitidas.map((p) => ({ ...p, clase: '', icono: 'icono-alerta' })),
  ]
    .map(
      (p) => `
        <div class="progreso-sede-item ${p.clase}">
          <span class="estado-icono"><svg class="icono-svg" aria-hidden="true"><use href="#${p.icono}"/></svg></span>
          <span class="nombre">${escaparHtml(p.entrada.institucion)} — ${escaparHtml(p.entrada.sede)}</span>
          <div class="detalle-error">${escaparHtml(p.mensaje)}</div>
        </div>`
    )
    .join('');

  $('btnSeguir').textContent = problemas.length ? 'Volver a la lista para reintentar' : 'Registrar más sedes';
}

function seguirRegistrando() {
  $('pantallaResultado').classList.add('oculto');
  $('formulario').classList.remove('oculto');
  marcadas.clear();
  refrescarTodo();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Inicialización ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  elMunicipio = $('selMunicipio');
  elInstitucion = $('selInstitucion');
  elSedesLista = $('sedesLista');
  elObservaciones = $('observaciones');
  elBtnAgregar = $('btnAgregar');
  elBtnGuardar = $('btnGuardar');
  elBtnTodas = $('btnTodas');

  renderOpciones();

  elMunicipio.addEventListener('change', () => {
    elInstitucion.value = '';
    marcadas.clear();
    poblarInstituciones();
    renderSedes();
    actualizarPasoRetorno();
    mostrarOk('');
  });
  elInstitucion.addEventListener('change', () => {
    marcadas.clear();
    renderSedes();
    actualizarPasoRetorno();
    mostrarOk('');
  });

  elSedesLista.addEventListener('change', alCambiarMarcadas);
  elBtnTodas.addEventListener('click', () => {
    const libres = sedesDeLaInstitucion().filter(disponible);
    const todas = libres.every((it) => marcadas.has(it.sede));
    marcadas.clear();
    if (!todas) libres.forEach((it) => marcadas.add(it.sede));
    renderSedes();
    actualizarPasoRetorno();
    mostrarOk('');
  });

  elObservaciones.addEventListener('input', actualizarContador);
  elBtnAgregar.addEventListener('click', agregarALista);
  elBtnGuardar.addEventListener('click', guardar);
  $('btnSeguir').addEventListener('click', seguirRegistrando);

  $('resumenCuerpo').addEventListener('click', (ev) => {
    const boton = ev.target.closest('[data-quitar]');
    if (boton) quitarDeLista(Number(boton.dataset.quitar));
  });

  cargarSedes();
});
