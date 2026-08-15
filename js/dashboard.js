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

function iconoSvg(id) {
  return `<svg class="icono-svg" aria-hidden="true"><use href="#${id}"></use></svg>`;
}

function escaparHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s == null ? '' : s);
  return d.innerHTML;
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

    registros = resReg.data.map(prepararFila);
    catalogos = resCat.data;
    totalSedesCatalogo = Object.values(catalogos.geo).reduce(
      (acc, ies) => acc + Object.values(ies).reduce((a, sedes) => a + sedes.length, 0),
      0
    );

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
  return {
    ...r,
    nivelClave: nivelValido ? r.nivel : NIVEL_SIN_CLASIFICAR,
    nivelOrden: nivelValido ? NIVELES.indexOf(r.nivel) : NIVELES.length,
    totalEvidencias: (r.evidencias || []).length,
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
  const estado = document.getElementById('filtroEstado').value;
  const padrino = document.getElementById('filtroPadrino').value;

  let lista = registros.filter((r) => {
    if (municipio && r.municipio !== municipio) return false;
    if (nivel && r.nivelClave !== nivel) return false;
    if (estado && r.estado !== estado) return false;
    if (padrino && r.padrino !== padrino) return false;
    if (texto) {
      const haystack = `${r.municipio} ${r.institucion} ${r.sede} ${r.padrino}`.toLowerCase();
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
  renderTabla(filtrados);
}

// ─── KPIs ────────────────────────────────────────────────────

function renderKpis(filtrados) {
  const reportadas = registros.length;
  const porcentaje = totalSedesCatalogo ? Math.round((reportadas / totalSedesCatalogo) * 100) : 0;
  document.getElementById('kpiCoberturaTexto').textContent = `${reportadas} / ${totalSedesCatalogo} sedes`;
  document.getElementById('kpiCoberturaRelleno').style.width = `${Math.min(porcentaje, 100)}%`;
  document.getElementById('kpiCoberturaPorcentaje').textContent = `${porcentaje}%`;

  const completas = filtrados.filter((r) => r.estado === 'Completo').length;
  document.getElementById('kpiCompletas').textContent = completas;
  document.getElementById('kpiCompletasSub').textContent = `de ${filtrados.length} reportadas`;

  const totalEv = filtrados.reduce((acc, r) => acc + r.totalEvidencias, 0);
  document.getElementById('kpiEvidencias').textContent = totalEv;

  const criticas = filtrados.filter((r) => r.nivelClave === 'Grave' || r.nivelClave === 'Inhabilitada').length;
  document.getElementById('kpiCriticas').textContent = criticas;
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

  cont.innerHTML = claves
    .map((clave, i) => {
      const etiqueta = clave === NIVEL_SIN_CLASIFICAR ? 'Sin clasificar' : clave;
      const n = conteos[i];
      const pct = Math.round((n / max) * 100);
      return `
        <div class="fila-barra">
          <span class="etiqueta-barra">${escaparHtml(etiqueta)}</span>
          <div class="pista-barra">
            <div class="segmento" style="width:${pct}%; background:${claseNivelBg(clave)};"></div>
          </div>
          <span class="valor-barra">${n}</span>
        </div>`;
    })
    .join('');
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

  document.getElementById('notaMunicipios').textContent = `${filas.length} municipio${filas.length === 1 ? '' : 's'} con reportes`;

  if (filas.length === 0) {
    cont.innerHTML = '<p class="tabla-vacia">Sin datos para los filtros actuales.</p>';
    return;
  }

  cont.innerHTML = filas
    .map((f) => {
      const segmentos = claves
        .filter((c) => f.niveles[c])
        .map((c) => {
          const pctDelTotal = (f.niveles[c] / f.total) * 100;
          const etiqueta = c === NIVEL_SIN_CLASIFICAR ? 'Sin clasificar' : c;
          return `<div class="segmento" data-tip="${etiqueta}: ${f.niveles[c]}" style="width:${pctDelTotal}%; background:${claseNivelBg(c)};"></div>`;
        })
        .join('');
      const anchoTotal = Math.round((f.total / max) * 100);
      return `
        <div class="fila-barra">
          <span class="etiqueta-barra" title="${escaparHtml(f.mun)}">${escaparHtml(f.mun)}</span>
          <div class="pista-barra" style="width:100%;">
            <div style="display:flex; width:${anchoTotal}%; height:100%;">${segmentos}</div>
          </div>
          <span class="valor-barra">${f.total}</span>
        </div>`;
    })
    .join('');

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

// ─── Tabla ───────────────────────────────────────────────────

function placaNivel(nivelClave) {
  const etiqueta = nivelClave === NIVEL_SIN_CLASIFICAR || !nivelClave ? 'Sin clasificar' : nivelClave;
  return `<span class="placa-nivel" data-nivel="${nivelClave || NIVEL_SIN_CLASIFICAR}">${escaparHtml(etiqueta)}</span>`;
}

function placaEstado(estado) {
  return `<span class="placa-estado" data-estado="${estado}">${escaparHtml(estado)}</span>`;
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
        <td class="col-fecha">${formatearFecha(r.timestamp)}</td>
        <td>${escaparHtml(r.municipio)}</td>
        <td class="col-institucion">${escaparHtml(r.institucion)}</td>
        <td class="col-sede">${escaparHtml(r.sede)}</td>
        <td>${escaparHtml(r.padrino)}</td>
        <td>${placaNivel(r.nivelClave)}</td>
        <td>${placaEstado(r.estado)}</td>
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
    <div class="detalle-sub">${escaparHtml(r.sede)} · ${escaparHtml(r.municipio)}</div>
    <div class="detalle-placas">${placaNivel(r.nivelClave)}${placaEstado(r.estado)}</div>

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
  const encabezados = ['Fecha', 'Municipio', 'Institución', 'Sede', 'Padrino', 'Nivel', 'Estado', 'Descripción', '# Evidencias', 'Carpeta Drive'];
  const csvEscapar = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

  const lineas = [encabezados.map(csvEscapar).join(',')];
  filas.forEach((r) => {
    lineas.push(
      [formatearFecha(r.timestamp), r.municipio, r.institucion, r.sede, r.padrino, r.nivelClave === NIVEL_SIN_CLASIFICAR ? '' : r.nivel, r.estado, r.descripcion, r.totalEvidencias, r.urlSede]
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
  ['filtroTexto', 'filtroMunicipio', 'filtroNivel', 'filtroEstado', 'filtroPadrino'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', renderizarTodo);
  });

  document.getElementById('btnLimpiarFiltros').addEventListener('click', () => {
    document.getElementById('filtroTexto').value = '';
    document.getElementById('filtroMunicipio').value = '';
    document.getElementById('filtroNivel').value = '';
    document.getElementById('filtroEstado').value = '';
    document.getElementById('filtroPadrino').value = '';
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
