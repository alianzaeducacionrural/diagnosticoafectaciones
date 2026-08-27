// ================================================
// PANEL DE CONTROL — Daños por sismo
// Trae TODAS las sedes registradas (accion=todosLosRegistros) y el catálogo
// completo (accion=catalogos, para calcular cobertura y llenar filtros),
// y arma KPIs, gráficos caseros (sin librerías) y una tabla interactiva.
// ================================================

const NIVELES = ['Sin daños', 'Leve', 'Moderado', 'Grave', 'Inhabilitada'];
const NIVEL_SIN_CLASIFICAR = '__sin_nivel__';

let registros = [];
let catalogos = null;
let totalSedesCatalogo = 0;
let orden = { campo: 'timestamp', dir: 'desc' };
let mapaConectividad = new Map();
let mapaSimat = new Map();

function iconoSvg(id) {
  return `<svg class="icono-svg" aria-hidden="true"><use href="#${id}"></use></svg>`;
}

function escaparHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s == null ? '' : s);
  return d.innerHTML;
}

// ─── Conectividad ────────────────────────────────────────────
// La pestaña "Conectividad" del Sheet se llena a mano por municipio/
// institución/sede en mayúsculas — se cruza por la misma clave natural
// que usa el backend (normalizada a minúsculas, sin depender del acento
// o de cómo esté capitalizado en cada lado).

function claveSedeJs(municipio, institucion, sede) {
  return [municipio, institucion, sede].map((s) => String(s || '').trim().toLowerCase()).join('|');
}

function construirMapaConectividad(lista) {
  const mapa = new Map();
  (lista || []).forEach((c) => {
    mapa.set(claveSedeJs(c.municipio, c.institucion, c.sede), c.conectividad);
  });
  return mapa;
}

// ─── Matrícula por nivel educativo ───────────────────────────
// "Simat 2025" (misma fuente que ya usa el backend para la Matrícula
// total de cada fila) trae el desglose Primaria/Posprimaria/Media por
// sede. A diferencia de Matrícula/DANE/Conectividad (que quedan
// guardados en la fila al momento del envío), este desglose se consulta
// en vivo desde catalogos.simat — no se persiste en "registros".
function construirMapaSimat(lista) {
  const mapa = new Map();
  (lista || []).forEach((s) => {
    mapa.set(claveSedeJs(s.municipio, s.institucion, s.sede), { primaria: s.primaria || 0, posprimaria: s.posprimaria || 0, media: s.media || 0 });
  });
  return mapa;
}

// ─── Carga ───────────────────────────────────────────────────

async function cargarTodo() {
  document.getElementById('panelCargando').classList.remove('oculto');
  document.getElementById('panelError').classList.add('oculto');
  document.getElementById('panelContenido').classList.add('oculto');

  try {
    const [resReg, resCat] = await Promise.all([
      fetch(`${CONFIG.GAS_URL}?accion=todosLosRegistros`).then((r) => r.json()),
      fetch(`${CONFIG.GAS_URL}?accion=catalogos`).then((r) => r.json()),
    ]);
    if (!resReg.ok) throw new Error(resReg.error);
    if (!resCat.ok) throw new Error(resCat.error);

    catalogos = resCat.data;
    totalSedesCatalogo = Object.values(catalogos.geo).reduce(
      (acc, ies) => acc + Object.values(ies).reduce((a, sedes) => a + sedes.length, 0),
      0
    );
    mapaConectividad = construirMapaConectividad(catalogos.conectividad);
    mapaSimat = construirMapaSimat(catalogos.simat);
    registros = resReg.data.map(prepararFila);

    poblarFiltros();
    renderizarTodo();

    document.getElementById('panelActualizado').textContent =
      'Actualizado ' + new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('panelCargando').classList.add('oculto');
    document.getElementById('panelContenido').classList.remove('oculto');
  } catch (err) {
    document.getElementById('panelCargando').classList.add('oculto');
    document.getElementById('panelError').classList.remove('oculto');
  }
}

function prepararFila(r) {
  const nivelValido = NIVELES.indexOf(r.nivel) !== -1;
  const clave = claveSedeJs(r.municipio, r.institucion, r.sede);
  const conectividad = mapaConectividad.has(clave) ? mapaConectividad.get(clave) : null; // null = sin dato
  const simat = mapaSimat.get(clave) || null;
  return {
    ...r,
    nivelClave: nivelValido ? r.nivel : NIVEL_SIN_CLASIFICAR,
    nivelOrden: nivelValido ? NIVELES.indexOf(r.nivel) : NIVELES.length,
    totalEvidencias: (r.evidencias || []).length,
    conectividad,
    conectividadOrden: conectividad === true ? 2 : conectividad === false ? 1 : 0,
    primaria: simat ? simat.primaria : null,
    posprimaria: simat ? simat.posprimaria : null,
    media: simat ? simat.media : null,
  };
}

function poblarFiltros() {
  const municipios = [...new Set(registros.map((r) => r.municipio))].sort();
  const padrinos = [...new Set(registros.map((r) => r.padrino))].sort();

  const selMun = document.getElementById('filtroMunicipio');
  municipios.forEach((m) => selMun.add(new Option(m, m)));

  const selPad = document.getElementById('filtroPadrino');
  padrinos.forEach((p) => selPad.add(new Option(p, p)));
}

// ─── Filtrado + orden ────────────────────────────────────────

function obtenerFiltrados() {
  const texto = document.getElementById('filtroTexto').value.trim().toLowerCase();
  const municipio = document.getElementById('filtroMunicipio').value;
  const nivel = document.getElementById('filtroNivel').value;
  const padrino = document.getElementById('filtroPadrino').value;
  const conectividad = document.getElementById('filtroConectividad').value;

  let lista = registros.filter((r) => {
    if (municipio && r.municipio !== municipio) return false;
    if (nivel && r.nivelClave !== nivel) return false;
    if (padrino && r.padrino !== padrino) return false;
    if (conectividad && claveConectividad(r.conectividad) !== conectividad) return false;
    if (texto) {
      const haystack = `${r.municipio} ${r.institucion} ${r.sede} ${r.padrino} ${r.daneSede || ''}`.toLowerCase();
      if (!haystack.includes(texto)) return false;
    }
    return true;
  });

  lista.sort((a, b) => {
    const va = a[orden.campo];
    const vb = b[orden.campo];
    let cmp;
    if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
    else cmp = String(va || '').localeCompare(String(vb || ''), 'es');
    return orden.dir === 'asc' ? cmp : -cmp;
  });

  return lista;
}

function renderizarTodo() {
  const filtrados = obtenerFiltrados();
  renderKpis(filtrados);
  renderGraficoNivel(filtrados);
  renderGraficoMunicipio(filtrados);
  renderGraficoConectividad(filtrados);
  renderTabla(filtrados);
  requestAnimationFrame(igualarAlturaGraficos);
}

// Iguala la altura de la tarjeta "Sedes reportadas por municipio" a la de
// "Nivel de afectación" (pantallas anchas, ambas en la misma fila). La
// lista de municipios llena ese alto con scroll interno — ver el media
// query de .grafico-municipio en dashboard.css.
function igualarAlturaGraficos() {
  const nivel = document.querySelector('.grafico-nivel');
  const municipio = document.querySelector('.grafico-municipio');
  if (!nivel || !municipio) return;
  if (window.innerWidth <= 1000) {
    municipio.style.height = '';
    return;
  }
  municipio.style.height = nivel.getBoundingClientRect().height + 'px';
}

// ─── KPIs ────────────────────────────────────────────────────

function renderKpis(filtrados) {
  const reportadas = registros.length;
  const porcentaje = totalSedesCatalogo ? Math.round((reportadas / totalSedesCatalogo) * 100) : 0;
  document.getElementById('kpiCoberturaTexto').textContent = `${reportadas} / ${totalSedesCatalogo} sedes`;
  document.getElementById('kpiCoberturaRelleno').style.width = `${Math.min(porcentaje, 100)}%`;
  document.getElementById('kpiCoberturaPorcentaje').textContent = `${porcentaje}%`;

  const criticas = filtrados.filter((r) => r.nivelClave === 'Grave' || r.nivelClave === 'Inhabilitada').length;
  document.getElementById('kpiCriticas').textContent = criticas;

  const conDato = filtrados.filter((r) => r.conectividad !== null);
  const conSi = conDato.filter((r) => r.conectividad === true).length;
  const conNo = conDato.length - conSi;
  document.getElementById('kpiConectividadSi').textContent = conSi;
  document.getElementById('kpiConectividadNo').textContent = conNo;
  document.getElementById('kpiConectividadSub').textContent = `de ${conDato.length} sede${conDato.length === 1 ? '' : 's'} con dato`;
  const pctSi = conDato.length ? (conSi / conDato.length) * 100 : 0;
  document.getElementById('kpiConectividadBarraSi').style.width = `${pctSi}%`;
  document.getElementById('kpiConectividadBarraNo').style.width = `${100 - pctSi}%`;

  const conSimat = filtrados.filter((r) => r.primaria !== null);
  const sumPrimaria = conSimat.reduce((acc, r) => acc + (r.primaria || 0), 0);
  const sumPosprimaria = conSimat.reduce((acc, r) => acc + (r.posprimaria || 0), 0);
  const sumMedia = conSimat.reduce((acc, r) => acc + (r.media || 0), 0);
  const totalMn = sumPrimaria + sumPosprimaria + sumMedia;
  document.getElementById('kpiMnTotal').textContent = totalMn.toLocaleString('es-CO');
  document.getElementById('kpiMnPrimaria').textContent = sumPrimaria.toLocaleString('es-CO');
  document.getElementById('kpiMnPosprimaria').textContent = sumPosprimaria.toLocaleString('es-CO');
  document.getElementById('kpiMnMedia').textContent = sumMedia.toLocaleString('es-CO');
  document.getElementById('kpiMnSub').textContent = `de ${conSimat.length} sede${conSimat.length === 1 ? '' : 's'} con dato`;
  document.getElementById('kpiMnBarraPrimaria').style.width = `${totalMn ? (sumPrimaria / totalMn) * 100 : 0}%`;
  document.getElementById('kpiMnBarraPosprimaria').style.width = `${totalMn ? (sumPosprimaria / totalMn) * 100 : 0}%`;
  document.getElementById('kpiMnBarraMedia').style.width = `${totalMn ? (sumMedia / totalMn) * 100 : 0}%`;
}

// ─── Gráfico: nivel de afectación ───────────────────────────

function claseNivelBg(clave) {
  const mapa = {
    'Sin daños': 'var(--nivel-sindanos)',
    Leve: 'var(--nivel-leve)',
    Moderado: 'var(--nivel-moderado)',
    Grave: 'var(--nivel-grave)',
    Inhabilitada: 'var(--nivel-inhab)',
  };
  return mapa[clave] || 'var(--nivel-ns)';
}

function renderGraficoNivel(filtrados) {
  const cont = document.getElementById('graficoNivel');
  const claves = [...NIVELES, NIVEL_SIN_CLASIFICAR];
  const conteos = claves.map((c) => filtrados.filter((r) => r.nivelClave === c).length);
  const max = Math.max(...conteos, 1);
  const nivelActivo = document.getElementById('filtroNivel').value;

  cont.innerHTML = claves
    .map((clave, i) => {
      const etiqueta = clave === NIVEL_SIN_CLASIFICAR ? 'Sin clasificar' : clave;
      const n = conteos[i];
      const pct = Math.round((n / max) * 100);
      const abierto = nivelActivo === clave;

      // Desglose SOLO de esta franja de nivel: qué municipios la componen.
      const porMun = {};
      filtrados.forEach((r) => {
        if (r.nivelClave !== clave) return;
        porMun[r.municipio] = (porMun[r.municipio] || 0) + 1;
      });
      const detalle = Object.entries(porMun).sort((a, b) => b[1] - a[1]);

      return `
        <div class="fila-barra-detalle-wrap${abierto ? ' abierto' : ''}" data-clave="${clave}">
          <div class="fila-barra fila-barra-click" data-role="fila-clicable">
            <span class="etiqueta-barra">${escaparHtml(etiqueta)}</span>
            <div class="pista-barra">
              <div class="segmento" style="width:${pct}%; background:${claseNivelBg(clave)};"></div>
            </div>
            <span class="valor-barra">${n}</span>
          </div>
          <div class="detalle-expandido"${abierto ? '' : ' style="display:none;"'}>
            ${
              detalle.length
                ? detalle.map(([mun, cant]) => `<div class="detalle-expandido-item"><span>${escaparHtml(mun)}</span><span>${cant}</span></div>`).join('')
                : '<p class="detalle-expandido-vacio">Sin sedes en este nivel.</p>'
            }
          </div>
        </div>`;
    })
    .join('');

  cont.querySelectorAll('[data-clave]').forEach((fila) => {
    fila.querySelector('[data-role="fila-clicable"]').addEventListener('click', () => {
      const sel = document.getElementById('filtroNivel');
      sel.value = sel.value === fila.dataset.clave ? '' : fila.dataset.clave;
      renderizarTodo();
    });
  });
}

// ─── Gráfico: sedes por municipio (barra apilada por nivel) ─

function renderGraficoMunicipio(filtrados) {
  const cont = document.getElementById('graficoMunicipio');
  const porMunicipio = {};
  filtrados.forEach((r) => {
    if (!porMunicipio[r.municipio]) porMunicipio[r.municipio] = {};
    porMunicipio[r.municipio][r.nivelClave] = (porMunicipio[r.municipio][r.nivelClave] || 0) + 1;
  });

  const filas = Object.entries(porMunicipio)
    .map(([mun, niveles]) => ({ mun, total: Object.values(niveles).reduce((a, b) => a + b, 0), niveles }))
    .sort((a, b) => b.total - a.total);

  const max = Math.max(...filas.map((f) => f.total), 1);
  const claves = [...NIVELES, NIVEL_SIN_CLASIFICAR];
  const municipioActivo = document.getElementById('filtroMunicipio').value;

  document.getElementById('notaMunicipios').textContent = `${filas.length} municipio${filas.length === 1 ? '' : 's'} con reportes · click en una barra para ver el detalle y filtrar`;

  if (filas.length === 0) {
    cont.innerHTML = '<p class="tabla-vacia">Sin datos para los filtros actuales.</p>';
    return;
  }

  cont.innerHTML = filas
    .map((f) => {
      const detalle = claves.filter((c) => f.niveles[c]);
      const segmentos = detalle
        .map((c) => {
          const pctDelTotal = (f.niveles[c] / f.total) * 100;
          const etiqueta = c === NIVEL_SIN_CLASIFICAR ? 'Sin clasificar' : c;
          return `<div class="segmento" data-tip="${etiqueta}: ${f.niveles[c]}" style="width:${pctDelTotal}%; background:${claseNivelBg(c)};"></div>`;
        })
        .join('');
      const anchoTotal = Math.round((f.total / max) * 100);
      const abierto = municipioActivo === f.mun;

      return `
        <div class="fila-barra-detalle-wrap${abierto ? ' abierto' : ''}" data-clave="${escaparHtml(f.mun)}">
          <div class="fila-barra fila-barra-click" data-role="fila-clicable">
            <span class="etiqueta-barra">${escaparHtml(f.mun)}</span>
            <div class="pista-barra" style="width:100%;">
              <div style="display:flex; width:${anchoTotal}%; height:100%;">${segmentos}</div>
            </div>
            <span class="valor-barra">${f.total}</span>
          </div>
          <div class="detalle-expandido"${abierto ? '' : ' style="display:none;"'}>
            ${detalle
              .map(
                (c) =>
                  `<div class="detalle-expandido-item">${placaNivel(c)}<span>${f.niveles[c]}</span></div>`
              )
              .join('')}
          </div>
        </div>`;
    })
    .join('');

  cont.querySelectorAll('[data-clave]').forEach((fila) => {
    fila.querySelector('[data-role="fila-clicable"]').addEventListener('click', () => {
      const sel = document.getElementById('filtroMunicipio');
      sel.value = sel.value === fila.dataset.clave ? '' : fila.dataset.clave;
      renderizarTodo();
    });
  });

  const leyenda = document.createElement('div');
  leyenda.className = 'leyenda-nivel';
  leyenda.innerHTML = claves
    .map((c) => {
      const etiqueta = c === NIVEL_SIN_CLASIFICAR ? 'Sin clasificar' : c;
      return `<span class="leyenda-nivel-item"><span class="leyenda-nivel-punto" style="background:${claseNivelBg(c)};"></span>${escaparHtml(etiqueta)}</span>`;
    })
    .join('');
  cont.appendChild(leyenda);
}

// ─── Gráfico: conectividad por municipio (solo sedes reportadas) ─
// A diferencia de los otros dos gráficos, esto NO viene de "registros"
// (nivel/estado): se cruza cada sede reportada contra la pestaña
// "Conectividad" del Sheet por su clave natural (Municipio|Institución|
// Sede) — ver prepararFila/claveSedeJs. Solo se muestran los municipios
// que ya tienen algún reporte, nunca el catálogo completo de 771 sedes.

const CONECTIVIDAD_CLAVES = ['si', 'no', 'sin_dato'];

function claseConectividadBg(clave) {
  const mapa = { si: 'var(--safe-ink)', no: 'var(--danger-ink)', sin_dato: 'var(--ink-400)' };
  return mapa[clave] || 'var(--ink-400)';
}

function etiquetaConectividad(clave) {
  if (clave === 'si') return 'Con conectividad';
  if (clave === 'no') return 'Sin conectividad';
  return 'Sin dato';
}

function claveConectividad(valor) {
  if (valor === true) return 'si';
  if (valor === false) return 'no';
  return 'sin_dato';
}

function renderGraficoConectividad(filtrados) {
  const cont = document.getElementById('graficoConectividad');
  const porMunicipio = {};
  filtrados.forEach((r) => {
    const clave = claveConectividad(r.conectividad);
    if (!porMunicipio[r.municipio]) porMunicipio[r.municipio] = {};
    porMunicipio[r.municipio][clave] = (porMunicipio[r.municipio][clave] || 0) + 1;
  });

  const filas = Object.entries(porMunicipio)
    .map(([mun, datos]) => ({ mun, total: Object.values(datos).reduce((a, b) => a + b, 0), datos }))
    .sort((a, b) => a.mun.localeCompare(b.mun, 'es'));

  const max = Math.max(...filas.map((f) => f.total), 1);
  const municipioActivo = document.getElementById('filtroMunicipio').value;

  document.getElementById('notaConectividad').textContent = `${filas.length} municipio${filas.length === 1 ? '' : 's'} con reportes · click en una barra para filtrar`;

  if (filas.length === 0) {
    cont.innerHTML = '<p class="tabla-vacia">Sin datos para los filtros actuales.</p>';
    document.getElementById('leyendaConectividad').innerHTML = '';
    return;
  }

  cont.innerHTML = filas
    .map((f) => {
      const detalle = CONECTIVIDAD_CLAVES.filter((c) => f.datos[c]);
      const segmentos = detalle
        .map((c) => {
          const pctDelTotal = (f.datos[c] / f.total) * 100;
          return `<div class="segmento" data-tip="${etiquetaConectividad(c)}: ${f.datos[c]}" style="width:${pctDelTotal}%; background:${claseConectividadBg(c)};"></div>`;
        })
        .join('');
      const anchoTotal = Math.round((f.total / max) * 100);
      const abierto = municipioActivo === f.mun;

      return `
        <div class="fila-barra-detalle-wrap${abierto ? ' abierto' : ''}" data-clave="${escaparHtml(f.mun)}">
          <div class="fila-barra fila-barra-click" data-role="fila-clicable">
            <span class="etiqueta-barra">${escaparHtml(f.mun)}</span>
            <div class="pista-barra" style="width:100%;">
              <div style="display:flex; width:${anchoTotal}%; height:100%;">${segmentos}</div>
            </div>
            <span class="valor-barra">${f.total}</span>
          </div>
          <div class="detalle-expandido"${abierto ? '' : ' style="display:none;"'}>
            ${detalle
              .map(
                (c) =>
                  `<div class="detalle-expandido-item"><span class="leyenda-nivel-punto" style="background:${claseConectividadBg(c)};"></span><span>${etiquetaConectividad(c)}</span><span>${f.datos[c]}</span></div>`
              )
              .join('')}
          </div>
        </div>`;
    })
    .join('');

  cont.querySelectorAll('[data-clave]').forEach((fila) => {
    fila.querySelector('[data-role="fila-clicable"]').addEventListener('click', () => {
      const sel = document.getElementById('filtroMunicipio');
      sel.value = sel.value === fila.dataset.clave ? '' : fila.dataset.clave;
      renderizarTodo();
    });
  });

  document.getElementById('leyendaConectividad').innerHTML = CONECTIVIDAD_CLAVES.map(
    (c) => `<span class="leyenda-nivel-item"><span class="leyenda-nivel-punto" style="background:${claseConectividadBg(c)};"></span>${etiquetaConectividad(c)}</span>`
  ).join('');
}

// ─── Tabla ───────────────────────────────────────────────────

function placaNivel(nivelClave) {
  const etiqueta = nivelClave === NIVEL_SIN_CLASIFICAR || !nivelClave ? 'Sin clasificar' : nivelClave;
  return `<span class="placa-nivel" data-nivel="${nivelClave || NIVEL_SIN_CLASIFICAR}">${escaparHtml(etiqueta)}</span>`;
}

function placaEstado(estado) {
  return `<span class="placa-estado" data-estado="${estado}">${escaparHtml(estado)}</span>`;
}

function placaConectividad(valor) {
  const clave = claveConectividad(valor);
  return `<span class="placa-conectividad" data-conectividad="${clave}">${escaparHtml(etiquetaConectividad(clave))}</span>`;
}

// Banner grande (no la placa pequeña) — para el panel de detalle de sede,
// donde la conectividad merece más peso visual que un simple chip.
function bannerConectividad(valor) {
  const clave = claveConectividad(valor);
  return `<div class="detalle-conectividad-banner" data-conectividad="${clave}">
    ${iconoSvg('icono-wifi')}
    <span>${escaparHtml(etiquetaConectividad(clave))}</span>
  </div>`;
}

// Chips de Primaria/Posprimaria/Media debajo del stat de matrícula total,
// en el detalle de sede. Solo se muestra si hay dato de Simat para esa
// sede (r.primaria !== null) y si al menos uno de los 3 niveles tiene
// estudiantes — evita chips en 0 para sedes sin ese nivel.
function desgloseMatriculaHtml(r) {
  if (r.primaria === null) return '';
  const niveles = [
    { clave: 'primaria', etiqueta: 'Primaria', valor: r.primaria },
    { clave: 'posprimaria', etiqueta: 'Posprimaria', valor: r.posprimaria },
    { clave: 'media', etiqueta: 'Media', valor: r.media },
  ].filter((n) => n.valor > 0);
  if (!niveles.length) return '';
  return `<div class="detalle-matricula-desglose">${niveles
    .map((n) => `<span class="detalle-matricula-chip" data-nivel-edu="${n.clave}"><strong>${n.valor}</strong> ${n.etiqueta}</span>`)
    .join('')}</div>`;
}

function formatearFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderTabla(filtrados) {
  const tbody = document.getElementById('tablaSedesBody');
  const vacia = document.getElementById('tablaVacia');
  document.getElementById('notaTabla').textContent = `${filtrados.length} sede${filtrados.length === 1 ? '' : 's'}`;

  if (filtrados.length === 0) {
    tbody.innerHTML = '';
    vacia.classList.remove('oculto');
    return;
  }
  vacia.classList.add('oculto');

  tbody.innerHTML = filtrados
    .map(
      (r, i) => `
      <tr data-idx="${i}">
        <td>${escaparHtml(r.municipio)}</td>
        <td class="col-institucion">${escaparHtml(r.institucion)}</td>
        <td class="col-sede">${escaparHtml(r.sede)}</td>
        <td class="col-matricula">${r.matricula || r.matricula === 0 ? escaparHtml(r.matricula) : '—'}</td>
        <td>${escaparHtml(r.padrino)}</td>
        <td>${placaNivel(r.nivelClave)}</td>
        <td>${placaConectividad(r.conectividad)}</td>
        <td><span class="contador-evidencia">${iconoSvg('icono-portapapeles')} ${r.totalEvidencias}</span></td>
      </tr>`
    )
    .join('');

  tbody.querySelectorAll('tr').forEach((tr) => {
    tr.addEventListener('click', () => abrirDetalle(filtrados[Number(tr.dataset.idx)]));
  });

  window._filasFiltradasActuales = filtrados;
}

function actualizarEncabezadosOrden() {
  document.querySelectorAll('#tablaSedes thead th[data-orden]').forEach((th) => {
    const activo = th.dataset.orden === orden.campo;
    th.classList.toggle('orden-activo', activo);
    th.classList.toggle('orden-desc', activo && orden.dir === 'desc');
  });
}

// ─── Panel de detalle ────────────────────────────────────────

function idDriveDeEvidencia(ev) {
  if (ev.id) return ev.id;
  const m = /\/d\/([^/]+)/.exec(ev.url || '');
  return m ? m[1] : '';
}

function iconoParaTipo(tipo) {
  if (tipo === 'foto') return 'icono-camara';
  if (tipo === 'video') return 'icono-video';
  return 'icono-documento';
}

function abrirDetalle(r) {
  const panel = document.getElementById('panelDetalle');
  const cuerpo = document.getElementById('panelDetalleCuerpo');

  const evidenciasHtml = (r.evidencias || []).length
    ? `<div class="detalle-evidencias">${r.evidencias
        .map((ev) => {
          const id = idDriveDeEvidencia(ev);
          if (!id) return `<div class="detalle-evidencia-item">${iconoSvg(iconoParaTipo(ev.tipo))}</div>`;
          if (ev.tipo === 'foto' || ev.tipo === 'video') {
            return `<div class="detalle-evidencia-item" data-id="${id}" data-nombre="${escaparHtml(ev.nombre)}" data-url="${escaparHtml(ev.url || '')}" data-tipo="${ev.tipo}">
              <img src="https://drive.google.com/thumbnail?id=${id}&sz=w300" loading="lazy" alt="" />
              ${ev.tipo === 'video' ? `<span class="miniatura-play">${iconoSvg('icono-video')}</span>` : ''}
            </div>`;
          }
          return `<div class="detalle-evidencia-item" data-id="${id}" data-nombre="${escaparHtml(ev.nombre)}" data-url="${escaparHtml(ev.url || '')}" data-tipo="documento">${iconoSvg('icono-documento')}</div>`;
        })
        .join('')}</div>`
    : '<p class="detalle-sin-evidencia">Sin evidencia adjunta todavía.</p>';

  cuerpo.innerHTML = `
    <div class="detalle-titulo">${escaparHtml(r.institucion)}</div>
    <div class="detalle-sub">${escaparHtml(r.sede)} · ${escaparHtml(r.municipio)}${r.daneSede ? ` · DANE ${escaparHtml(r.daneSede)}` : ''}</div>
    <div class="detalle-placas">${placaNivel(r.nivelClave)}${placaEstado(r.estado)}</div>
    ${bannerConectividad(r.conectividad)}
    ${r.matricula ? `<div class="detalle-matricula-stat">${iconoSvg('icono-personas')} <strong>${escaparHtml(r.matricula)}</strong> estudiantes matriculados</div>` : ''}
    ${desgloseMatriculaHtml(r)}

    <div class="detalle-bloque">
      <h3>Contacto</h3>
      <div class="detalle-linea"><span>Padrino</span><span>${escaparHtml(r.padrino)}</span></div>
      ${r.correoPadrino ? `<div class="detalle-linea"><span>Correo padrino</span><span>${escaparHtml(r.correoPadrino)}</span></div>` : ''}
      ${r.telefonoPadrino ? `<div class="detalle-linea"><span>Teléfono padrino</span><span>${escaparHtml(r.telefonoPadrino)}</span></div>` : ''}
      ${r.rectorNombre ? `<div class="detalle-linea"><span>Rector</span><span>${escaparHtml(r.rectorNombre)}</span></div>` : ''}
      ${r.rectorTelefono ? `<div class="detalle-linea"><span>Teléfono rector</span><span>${escaparHtml(r.rectorTelefono)}</span></div>` : ''}
    </div>

    ${
      r.descripcion
        ? `<div class="detalle-bloque"><h3>Descripción del daño</h3><div class="detalle-descripcion">${escaparHtml(r.descripcion)}</div></div>`
        : ''
    }

    <div class="detalle-bloque">
      <h3>Evidencia (${r.totalEvidencias})</h3>
      ${evidenciasHtml}
      ${r.urlSede ? `<a class="detalle-enlace-drive" href="${escaparHtml(r.urlSede)}" target="_blank" rel="noopener">${iconoSvg('icono-marcador')} Ver carpeta en Drive</a>` : ''}
    </div>
  `;

  cuerpo.querySelectorAll('.detalle-evidencia-item[data-id]').forEach((el) => {
    el.addEventListener('click', () => abrirPrevia(el.dataset.nombre, el.dataset.url, el.dataset.id, el.dataset.tipo));
    const img = el.querySelector('img');
    if (img) img.addEventListener('error', () => { img.replaceWith(document.createRange().createContextualFragment(iconoSvg(iconoParaTipo(el.dataset.tipo)))); }, { once: true });
  });

  panel.classList.remove('oculto');
}

function cerrarDetalle() {
  document.getElementById('panelDetalle').classList.add('oculto');
}

// ─── Modal de previsualización (igual que en index.html) ───

function etiquetaTipo(tipo) {
  if (tipo === 'foto') return 'Foto';
  if (tipo === 'video') return 'Video';
  return 'Documento';
}

function abrirPrevia(nombre, url, id, tipo) {
  const modal = document.getElementById('modalPrevia');
  modal.querySelector('[data-role="modal-nombre"]').textContent = nombre;
  modal.querySelector('[data-role="modal-tipo"]').innerHTML = `${iconoSvg(iconoParaTipo(tipo))} ${etiquetaTipo(tipo)}`;
  modal.querySelector('[data-role="modal-abrir"]').href = url || `https://drive.google.com/file/d/${id}/view`;
  modal.querySelector('[data-role="modal-cuerpo"]').innerHTML =
    `<iframe src="https://drive.google.com/file/d/${id}/preview" allow="autoplay" allowfullscreen></iframe>`;
  modal.classList.remove('oculto');
}

function cerrarPrevia() {
  const modal = document.getElementById('modalPrevia');
  modal.classList.add('oculto');
  modal.querySelector('[data-role="modal-cuerpo"]').innerHTML = '';
}

// ─── CSV ─────────────────────────────────────────────────────

function descargarCsv() {
  const filas = window._filasFiltradasActuales || [];
  const encabezados = [
    'Fecha', 'Municipio', 'Institución', 'Sede', 'Código DANE', 'Matrícula', 'Padrino',
    'Nivel', 'Estado', 'Conectividad', 'Descripción', '# Evidencias', 'Carpeta Drive',
  ];
  const csvEscapar = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

  const lineas = [encabezados.map(csvEscapar).join(',')];
  filas.forEach((r) => {
    lineas.push(
      [
        formatearFecha(r.timestamp), r.municipio, r.institucion, r.sede, r.daneSede, r.matricula, r.padrino,
        r.nivelClave === NIVEL_SIN_CLASIFICAR ? '' : r.nivel, r.estado, etiquetaConectividad(claveConectividad(r.conectividad)),
        r.descripcion, r.totalEvidencias, r.urlSede,
      ]
        .map(csvEscapar)
        .join(',')
    );
  });

  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sedes-sismo-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Inicialización ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  let temporizadorResize;
  window.addEventListener('resize', () => {
    clearTimeout(temporizadorResize);
    temporizadorResize = setTimeout(igualarAlturaGraficos, 150);
  });

  ['filtroTexto', 'filtroMunicipio', 'filtroNivel', 'filtroPadrino', 'filtroConectividad'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', renderizarTodo);
  });

  document.getElementById('btnLimpiarFiltros').addEventListener('click', () => {
    document.getElementById('filtroTexto').value = '';
    document.getElementById('filtroMunicipio').value = '';
    document.getElementById('filtroNivel').value = '';
    document.getElementById('filtroPadrino').value = '';
    document.getElementById('filtroConectividad').value = '';
    renderizarTodo();
  });

  document.querySelectorAll('#tablaSedes thead th[data-orden]').forEach((th) => {
    th.addEventListener('click', () => {
      const campo = th.dataset.orden;
      if (orden.campo === campo) orden.dir = orden.dir === 'asc' ? 'desc' : 'asc';
      else orden = { campo, dir: 'asc' };
      actualizarEncabezadosOrden();
      renderizarTodo();
    });
  });
  actualizarEncabezadosOrden();

  document.getElementById('btnRefrescar').addEventListener('click', cargarTodo);
  document.getElementById('btnReintentarCarga').addEventListener('click', cargarTodo);
  document.getElementById('btnDescargarCsv').addEventListener('click', descargarCsv);

  document.querySelectorAll('[data-role="detalle-cerrar"]').forEach((el) => el.addEventListener('click', cerrarDetalle));
  document.querySelectorAll('[data-role="modal-cerrar"]').forEach((el) => el.addEventListener('click', cerrarPrevia));
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    cerrarPrevia();
    cerrarDetalle();
  });

  cargarTodo();
});
