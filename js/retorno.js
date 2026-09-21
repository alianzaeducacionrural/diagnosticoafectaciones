// ================================================
// Retorno a clases — lógica del formulario pequeño (retorno.html)
// Trae solo las sedes que ya tienen reporte (accion=sedesRetorno), arma la
// cascada Municipio→Institución→Sede, y guarda el retorno de una sede por
// vez (accion=guardarRetorno). Muestra un resumen antes de guardar y otra
// vez en la pantalla de confirmación.
// ================================================

const MAX_OBSERVACIONES = 1000;

let arbol = {}; // municipio → institución → [{ municipio, institucion, sede, retorno, retornoObs }]
let sedeActual = null; // el item de arbol que está elegido, o null
let retornoElegido = '';

let elMunicipio, elInstitucion, elSede, elObservaciones, elBtnGuardar;

// ─── Utilidades ──────────────────────────────────────────────

function escaparHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s == null ? '' : s);
  return d.innerHTML;
}

function ordenarEs(lista) {
  return lista.sort((a, b) => a.localeCompare(b, 'es'));
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
  const banner = document.getElementById('mensajeError');
  if (!mensaje) {
    banner.classList.add('oculto');
    return;
  }
  banner.querySelector('[data-role="texto"]').textContent = mensaje;
  banner.classList.remove('oculto');
  banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    poblarMunicipios();
    document.getElementById('cargandoSedes').classList.add('oculto');
    document.getElementById('formulario').classList.remove('oculto');
  } catch (err) {
    document.getElementById('cargandoSedes').classList.add('oculto');
    document.getElementById('errorSedes').classList.remove('oculto');
  }
}

// ─── Cascada Municipio → Institución → Sede ──────────────────

function reiniciarSelect(select, textoVacio, deshabilitado) {
  select.innerHTML = `<option value="">${textoVacio}</option>`;
  select.disabled = deshabilitado;
}

function poblarMunicipios() {
  reiniciarSelect(elMunicipio, '— Selecciona un municipio —', false);
  ordenarEs(Object.keys(arbol)).forEach((m) => elMunicipio.add(new Option(m, m)));
}

function poblarInstituciones() {
  reiniciarSelect(elInstitucion, '— Primero elige el municipio —', true);
  const municipio = elMunicipio.value;
  if (!municipio) return;
  elInstitucion.options[0].textContent = '— Selecciona la institución —';
  ordenarEs(Object.keys(arbol[municipio])).forEach((ie) => elInstitucion.add(new Option(ie, ie)));
  elInstitucion.disabled = false;
}

function poblarSedes() {
  reiniciarSelect(elSede, '— Primero elige la institución —', true);
  const municipio = elMunicipio.value;
  const institucion = elInstitucion.value;
  if (!municipio || !institucion) return;
  elSede.options[0].textContent = '— Selecciona la sede —';
  arbol[municipio][institucion]
    .slice()
    .sort((a, b) => a.sede.localeCompare(b.sede, 'es'))
    .forEach((s) => elSede.add(new Option(s.sede + (s.retorno ? ' ✓' : ''), s.sede)));
  elSede.disabled = false;
}

function alCambiarSede() {
  const municipio = elMunicipio.value;
  const institucion = elInstitucion.value;
  const sede = elSede.value;
  sedeActual = sede ? arbol[municipio][institucion].find((s) => s.sede === sede) : null;

  mostrarError('');
  document.getElementById('cardRetorno').classList.toggle('oculto', !sedeActual);
  document.getElementById('cardResumen').classList.toggle('oculto', !sedeActual);
  document.getElementById('accionesEnvio').classList.toggle('oculto', !sedeActual);
  if (!sedeActual) return;

  // Si ya tenía retorno, se precarga para poder verlo o corregirlo.
  const previo = RETORNO_OPCIONES.find((o) => o.valor === sedeActual.retorno);
  document.getElementById('avisoPrevio').classList.toggle('oculto', !previo);
  elegirRetorno(previo ? previo.valor : '');
  elObservaciones.value = previo ? sedeActual.retornoObs : '';
  actualizarContador();
  actualizarResumen();
}

// ─── Opciones de retorno ─────────────────────────────────────

function renderOpciones() {
  const cont = document.getElementById('opcionesRetorno');
  cont.innerHTML = RETORNO_OPCIONES.map(
    (o) => `
      <label class="retorno-opcion" data-retorno="${o.clave}">
        <input type="radio" name="retorno" value="${escaparHtml(o.valor)}" />
        <span class="retorno-opcion-punto"></span>
        <span>${escaparHtml(o.valor)}</span>
      </label>`
  ).join('');

  cont.querySelectorAll('input[name="retorno"]').forEach((input) => {
    input.addEventListener('change', () => {
      elegirRetorno(input.value);
      actualizarResumen();
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
  elBtnGuardar.disabled = !valor;
}

function actualizarContador() {
  document.getElementById('contadorObs').textContent = `${elObservaciones.value.length} / ${MAX_OBSERVACIONES}`;
}

// ─── Resumen ─────────────────────────────────────────────────

function resumenHtml(d) {
  const opcion = RETORNO_OPCIONES.find((o) => o.valor === d.retorno);
  const placa = opcion
    ? `<span class="placa-retorno" data-retorno="${opcion.clave}">${escaparHtml(opcion.valor)}</span>`
    : '<span class="resumen-vacio">Sin seleccionar</span>';
  const obs = d.observaciones
    ? `<span class="resumen-obs">${escaparHtml(d.observaciones)}</span>`
    : '<span class="resumen-vacio">Sin observaciones</span>';
  return `
    <dl class="resumen">
      <div><dt>Municipio</dt><dd>${escaparHtml(d.municipio)}</dd></div>
      <div><dt>Institución</dt><dd>${escaparHtml(d.institucion)}</dd></div>
      <div><dt>Sede</dt><dd>${escaparHtml(d.sede)}</dd></div>
      <div><dt>Retorno a clases</dt><dd>${placa}</dd></div>
      <div><dt>Observaciones</dt><dd>${obs}</dd></div>
    </dl>`;
}

function datosActuales() {
  return {
    municipio: sedeActual.municipio,
    institucion: sedeActual.institucion,
    sede: sedeActual.sede,
    retorno: retornoElegido,
    observaciones: elObservaciones.value.trim(),
  };
}

function actualizarResumen() {
  if (!sedeActual) return;
  document.getElementById('resumenCuerpo').innerHTML = resumenHtml(datosActuales());
}

// ─── Guardado ────────────────────────────────────────────────

async function guardar() {
  if (!sedeActual || !retornoElegido) {
    mostrarError('Elige una opción de retorno a clases antes de guardar.');
    return;
  }
  mostrarError('');

  const datos = datosActuales();
  document.getElementById('formulario').classList.add('oculto');
  document.getElementById('pantallaEnvio').classList.remove('oculto');

  try {
    await postGAS({ accion: 'guardarRetorno', ...datos });

    // Se actualiza la copia local para que la sede aparezca con ✓ sin recargar.
    sedeActual.retorno = datos.retorno;
    sedeActual.retornoObs = datos.observaciones;

    document.getElementById('resumenGuardado').innerHTML = resumenHtml(datos);
    document.getElementById('pantallaEnvio').classList.add('oculto');
    document.getElementById('pantallaResultado').classList.remove('oculto');
  } catch (err) {
    document.getElementById('pantallaEnvio').classList.add('oculto');
    document.getElementById('formulario').classList.remove('oculto');
    mostrarError(`No se pudo guardar: ${err.message || 'revisa tu conexión e intenta de nuevo.'}`);
  }
}

// Vuelve al formulario dejando municipio e institución elegidos: lo normal
// es cargar varias sedes seguidas de la misma institución.
function registrarOtraSede() {
  document.getElementById('pantallaResultado').classList.add('oculto');
  document.getElementById('formulario').classList.remove('oculto');
  poblarSedes();
  alCambiarSede();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Inicialización ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  elMunicipio = document.getElementById('selMunicipio');
  elInstitucion = document.getElementById('selInstitucion');
  elSede = document.getElementById('selSede');
  elObservaciones = document.getElementById('observaciones');
  elBtnGuardar = document.getElementById('btnGuardar');

  renderOpciones();

  elMunicipio.addEventListener('change', () => {
    poblarInstituciones();
    poblarSedes();
    alCambiarSede();
  });
  elInstitucion.addEventListener('change', () => {
    poblarSedes();
    alCambiarSede();
  });
  elSede.addEventListener('change', alCambiarSede);

  elObservaciones.addEventListener('input', () => {
    actualizarContador();
    actualizarResumen();
  });

  elBtnGuardar.addEventListener('click', guardar);
  document.getElementById('btnOtraSede').addEventListener('click', registrarOtraSede);

  cargarSedes();
});
