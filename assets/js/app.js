/* =======================================================
   PLAN HAI GROUP · PANEL
   Lee y escribe en Notion a través de la función plan-hai (Supabase).
   Notion es la única fuente: este archivo no guarda montos ni datos personales.
   ======================================================= */
(() => {
    'use strict';

    // --- 1. CONFIGURACIÓN ---
    const CFG = window.PLAN_CONFIG || {};
    const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
    // En local se puede apuntar a otra API con ?api=… (en el sitio publicado no, para no filtrar la clave)
    const API = (LOCAL && new URLSearchParams(location.search).get('api')) || CFG.API_URL || '';
    const K_CLAVE = 'planHai.clave', K_CACHE = 'planHai.cache', K_PREFS = 'planHai.prefs';
    const CADA = 60000;
    const REPO = 'https://github.com/agustin0707/plan-hai-group#readme';
    const VISTAS = ['hoy', 'tareas', 'calendario', 'pagos', 'propuesta'];
    const NOMBRES = { hoy: 'Hoy', tareas: 'Tareas', calendario: 'Calendario', pagos: 'Pagos', propuesta: 'Propuesta' };

    // Módulos = opciones de "Categoría" en Notion. Teal para Hai Group, grises para administración.
    const MODULOS = [
        { id: 'Preparación', corto: 'Preparación', c: '#3A3A38' },
        { id: 'Coordinación con cliente', corto: 'Cliente', c: '#8E8E8B' },
        { id: 'Cotización / Honorarios', corto: 'Honorarios', c: '#BDBDB8' },
        { id: 'Propuesta', corto: 'Propuesta', c: '#0E2A26' },
        { id: 'Descubrimiento', corto: 'Descubrimiento', c: '#0D5746' },
        { id: 'Marca', corto: 'Marca', c: '#0A7465' },
        { id: 'LinkedIn', corto: 'LinkedIn', c: '#088A7D' },
        { id: 'Sitio web', corto: 'Sitio web', c: '#17A19A' },
        { id: 'Agentes', corto: 'Agentes', c: '#41B3AA' },
        { id: 'Campañas', corto: 'Campañas', c: '#7FD3CB' },
        { id: 'Google Ads', corto: 'Google Ads', c: '#B3E0DD' },
    ];
    const MOD = Object.fromEntries(MODULOS.map((m) => [m.id, m]));
    const modulo = (id) => MOD[id] || { id, corto: id || 'Sin módulo', c: '#8E8E8B' };
    const MOD_DEFECTO = 'Coordinación con cliente';

    // --- 2. UTILIDADES ---
    const $ = (s, el = document) => el.querySelector(s);
    const $$ = (s, el = document) => [...el.querySelectorAll(s)];
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const norma = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const clp = (n) => '$' + Math.round(n).toLocaleString('es-CL');

    const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
    const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
    const quitar = (k) => { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } };

    // Fechas como texto YYYY-MM-DD, siempre en hora local
    const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const pad = (n) => String(n).padStart(2, '0');
    const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const aFecha = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
    const sumar = (s, n) => { const d = aFecha(s); d.setDate(d.getDate() + n); return iso(d); };
    const dif = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 864e5);
    const hoy = () => iso(new Date());
    const lunes = (s) => { const d = aFecha(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
    const domingo = () => sumar(lunes(hoy()), 6);
    const corta = (s) => { const d = aFecha(s); return `${d.getDate()} ${MESES_C[d.getMonth()]}`; };
    const larga = (s) => { const d = aFecha(s); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
    const mesLargo = (ym) => { const [y, m] = ym.split('-').map(Number); return `${cap(MESES[m - 1])} ${y}`; };

    function cuando(s) {
        const n = dif(hoy(), s);
        if (n === 0) return 'hoy';
        if (n === 1) return 'mañana';
        if (n === -1) return 'ayer';
        if (n < 0) return `hace ${-n} días`;
        if (n < 7) return `${DIAS_C[aFecha(s).getDay()]} ${aFecha(s).getDate()}`;
        return corta(s);
    }
    function faltan(s) {
        const n = dif(hoy(), s);
        if (n === 0) return 'hoy';
        if (n === 1) return 'mañana';
        if (n < 0) return `hace ${-n} d`;
        return `en ${n} d`;
    }
    function hace(at) {
        if (!at) return '';
        const s = Math.max(0, (Date.now() - new Date(at)) / 1000);
        if (s < 60) return 'al día';
        if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
        return `hace ${Math.floor(s / 3600)} h`;
    }

    // --- 3. ESTADO ---
    const prefs = (() => { try { return JSON.parse(leer(K_PREFS)) || {}; } catch { return {}; } })();
    const S = {
        tasks: [], pagos: [], periodos: [], at: null, listo: false,
        vista: 'hoy',
        filtro: prefs.filtro || 'todas',
        cat: prefs.cat || '',
        ocultarHechas: !!prefs.ocultarHechas,
        buscar: '',
        mes: hoy().slice(0, 7),
        dia: hoy(),
        pendientes: 0, escrituras: 0, error: null, ultimaCarga: 0,
        editando: null,
    };
    let clave = leer(K_CLAVE) || '';
    const guardarPrefs = () => guardar(K_PREFS, JSON.stringify({ filtro: S.filtro, cat: S.cat, ocultarHechas: S.ocultarHechas, ultimaCat: prefs.ultimaCat }));

    const buscarTarea = (id) => S.tasks.find((t) => t.id === id);
    const abierta = (t) => t.status !== 'hecho';
    const atrasada = (t) => abierta(t) && t.date && t.date < hoy();
    const periodoDe = (s) => S.periodos.find((p) => s >= p.start && s <= (p.end || p.start));
    const orden = (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (b.priority - a.priority) || (b.milestone - a.milestone) || a.title.localeCompare(b.title, 'es');

    const FILTROS = [
        { id: 'todas', txt: 'Todas', f: () => true },
        { id: 'atrasadas', txt: 'Atrasadas', f: atrasada, rojo: true },
        { id: 'semana', txt: 'Esta semana', f: (t) => abierta(t) && t.date && t.date >= hoy() && t.date <= domingo() },
        { id: 'prioritarias', txt: 'Prioritarias', f: (t) => abierta(t) && t.priority },
        { id: 'hitos', txt: 'Hitos', f: (t) => t.milestone },
        { id: 'en_curso', txt: 'En curso', f: (t) => t.status === 'en_curso' },
        { id: 'bloqueadas', txt: 'Bloqueadas', f: (t) => t.status === 'bloqueado' },
    ];

    // --- 4. API ---
    async function api(method, body) {
        const r = await fetch(API, {
            method,
            headers: body ? { 'x-plan-key': clave, 'content-type': 'application/json' } : { 'x-plan-key': clave },
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store',
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { const e = new Error(j.error || `Error ${r.status}`); e.status = r.status; throw e; }
        return j;
    }

    function aplicar(d) {
        S.tasks = d.tasks || [];
        S.pagos = d.pagos || [];
        S.periodos = d.periodos || [];
        S.at = d.at || null;
        S.listo = true;
        render();
    }
    const guardarCache = () => guardar(K_CACHE, JSON.stringify({ tasks: S.tasks.filter((t) => !t.tmp), pagos: S.pagos, periodos: S.periodos, at: S.at }));

    async function cargar() {
        if (!clave || !API || S.pendientes || S.editando) return;
        S.ultimaCarga = Date.now();
        const version = S.escrituras;
        if (!S.listo) sync('cargando');
        try {
            const d = await api('GET');
            // Si hubo una edición mientras leía, esta lectura es vieja: no pisarla
            if (S.pendientes || S.editando || version !== S.escrituras) return;
            S.error = null;
            aplicar(d);
            guardarCache();
        } catch (e) {
            if (e.status === 401) return salir('La clave cambió. Vuelve a entrar.');
            S.error = e.message;
        }
        sync();
    }

    async function enviar(op) {
        S.pendientes++;
        S.escrituras++;
        sync();
        try {
            const r = await api('POST', op);
            S.error = null;
            return r;
        } catch (e) {
            S.error = e.message;
            aviso(`No se guardó en Notion: ${e.message}`, null, true);
            if (e.status === 401) setTimeout(() => salir('La clave cambió. Vuelve a entrar.'), 1500);
            return null;
        } finally {
            S.pendientes--;
            sync();
        }
    }

    function reemplazar(t) {
        const i = S.tasks.findIndex((x) => x.id === t.id);
        if (i >= 0) S.tasks[i] = t; else S.tasks.push(t);
    }

    // --- 5. ESCRITURAS (optimistas, con deshacer) ---
    async function actualizar(id, patch, { mensaje, deshacer = true } = {}) {
        const t = buscarTarea(id);
        if (!t || t.tmp) return;
        const antes = {};
        for (const k in patch) antes[k] = t[k];
        Object.assign(t, patch);
        render();
        const r = await enviar({ op: 'update', id, patch });
        if (!r) { Object.assign(t, antes); render(); return; }
        reemplazar(r.task);
        render();
        guardarCache();
        if (mensaje) aviso(mensaje, deshacer ? () => actualizar(id, antes, { mensaje: 'Listo, quedó como estaba', deshacer: false }) : null);
    }

    async function crear(datos) {
        const tmp = { id: 'tmp' + Date.now(), title: datos.title, date: datos.date || null, module: datos.module, status: datos.status || 'pendiente', priority: !!datos.priority, milestone: !!datos.milestone, notes: datos.notes || '', url: null, tmp: true };
        S.tasks.push(tmp);
        render();
        const r = await enviar({ op: 'create', task: datos });
        S.tasks = S.tasks.filter((x) => x !== tmp);
        if (!r) { render(); return null; }
        S.tasks.push(r.task);
        render();
        guardarCache();
        aviso(`Creada para ${r.task.date ? cuando(r.task.date) : 'sin fecha'}`, () => borrar(r.task.id, { mensaje: 'Tarea quitada', deshacer: false }));
        return r.task;
    }

    async function borrar(id, { mensaje = 'Tarea borrada', deshacer = true } = {}) {
        const t = buscarTarea(id);
        if (!t || t.tmp) return;
        S.tasks = S.tasks.filter((x) => x !== t);
        render();
        const r = await enviar({ op: 'archive', id });
        if (!r) { S.tasks.push(t); render(); return; }
        guardarCache();
        aviso(mensaje, deshacer ? () => restaurar(t) : null);
    }

    async function restaurar(t) {
        S.tasks.push(t);
        render();
        const r = await enviar({ op: 'restore', id: t.id });
        if (!r) { S.tasks = S.tasks.filter((x) => x !== t); render(); return; }
        reemplazar(r.task);
        render();
        guardarCache();
        aviso('Tarea recuperada');
    }

    async function cambiarPago(id, estado, deshacer = true) {
        const p = S.pagos.find((x) => x.id === id);
        if (!p || p.estado === estado) return;
        const antes = { estado: p.estado, pagadaEl: p.pagadaEl };
        p.estado = estado;
        p.pagadaEl = estado === 'pagada' ? hoy() : null;
        render();
        const r = await enviar({ op: 'pago', id, estado });
        if (!r) { Object.assign(p, antes); render(); return; }
        Object.assign(p, r.pago);
        render();
        guardarCache();
        aviso(`${mesLargo(p.mes)}: ${estado}`, deshacer ? () => cambiarPago(id, antes.estado, false) : null);
    }

    function alternarHecha(id) {
        const t = buscarTarea(id);
        if (!t) return;
        const hecha = t.status !== 'hecho';
        actualizar(id, { status: hecha ? 'hecho' : 'pendiente' }, { mensaje: hecha ? 'Hecha' : 'Vuelve a pendiente' });
    }

    function mover(id, dias) {
        const t = buscarTarea(id);
        if (!t) return;
        const base = t.date && t.date >= hoy() ? t.date : hoy();
        const nueva = sumar(base, dias);
        actualizar(id, { date: nueva }, { mensaje: `Movida a ${larga(nueva)}` });
    }

    // --- 6. INDICADOR DE SINCRONIZACIÓN, RELOJ Y AVISOS ---
    function sync(forzado) {
        const el = $('#sync'), txt = $('#sync-texto');
        let estado = forzado;
        if (!estado) estado = S.pendientes ? 'guardando' : S.error ? 'error' : S.listo ? 'ok' : 'cargando';
        el.dataset.estado = estado;
        txt.textContent = {
            cargando: 'Conectando con Notion',
            guardando: 'Guardando',
            error: 'Sin conexión',
            cache: 'Copia local',
            ok: `Notion · ${hace(S.at)}`,
        }[estado];
        el.title = estado === 'error' ? `${S.error}. Toca para reintentar (R)` : 'Actualizar desde Notion (R)';
    }

    let diaActual = hoy();
    function reloj() {
        const d = new Date();
        $('#reloj').textContent = `${DIAS_C[d.getDay()]} ${d.getDate()} ${MESES_C[d.getMonth()]} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        if (!S.pendientes && !S.error && S.listo) sync();
        if (hoy() !== diaActual) {
            // Cambió el día con el panel abierto: lo que apuntaba a "hoy" pasa al nuevo día
            const antes = diaActual;
            diaActual = hoy();
            if (S.dia === antes) { S.dia = diaActual; S.mes = diaActual.slice(0, 7); }
            if ($('#rapida-fecha').value === antes) $('#rapida-fecha').value = diaActual;
            render();
        }
    }

    let avisoTimer;
    function aviso(texto, deshacer, error = false) {
        const el = $('#aviso');
        clearTimeout(avisoTimer);
        el.className = 'aviso' + (error ? ' error' : '');
        el.innerHTML = `<span>${esc(texto)}</span>`;
        if (deshacer) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = 'Deshacer';
            b.addEventListener('click', () => { el.hidden = true; deshacer(); });
            el.appendChild(b);
        }
        el.hidden = false;
        avisoTimer = setTimeout(() => { el.hidden = true; }, deshacer ? 6500 : error ? 6000 : 3000);
    }

    // --- 7. PIEZAS DE INTERFAZ ---
    function etiquetas(t) {
        let h = '';
        if (t.status === 'en_curso') h += '<span class="tag en_curso">En curso</span>';
        if (t.status === 'bloqueado') h += '<span class="tag bloqueado">Bloqueado</span>';
        if (t.priority && abierta(t)) h += '<span class="tag prioritaria">Prioritaria</span>';
        if (t.milestone) h += '<span class="tag hito">◆ Hito</span>';
        return h;
    }

    function fila(t, { sinModulo = false } = {}) {
        const m = modulo(t.module);
        const hecha = t.status === 'hecho';
        const cls = atrasada(t) ? ' atrasada' : t.date === hoy() && !hecha ? ' hoy' : '';
        return `<div class="fila${hecha ? ' hecha' : ''}${t.tmp ? ' temporal' : ''}" data-id="${esc(t.id)}">
            <button type="button" class="caja" role="checkbox" aria-checked="${hecha}" aria-label="Marcar «${esc(t.title)}» como hecha" data-accion="hecha"></button>
            <button type="button" class="fila-cuerpo" data-accion="abrir">
                <span class="fila-titulo">${esc(t.title)}</span>
                <span class="fila-meta mono">${sinModulo ? '' : `<span class="modulo"><i class="dot" style="--c:${m.c}"></i>${esc(m.corto)}</span>`}${etiquetas(t)}${t.notes ? '<span title="Tiene notas">Notas</span>' : ''}</span>
            </button>
            <div class="fila-der">
                ${hecha ? '' : '<span class="fila-acciones"><button type="button" class="mini" data-accion="d1" title="Mover un día">+1 día</button><button type="button" class="mini" data-accion="d7" title="Mover una semana">+1 sem</button></span>'}
                <span class="fila-fecha mono${cls}">${t.date ? cuando(t.date) : 'sin fecha'}</span>
            </div>
        </div>`;
    }

    const lista = (arr, vacio, opts) => arr.length ? arr.map((t) => fila(t, opts)).join('') : `<p class="vacio">${vacio}</p>`;

    // --- 8. VISTA HOY ---
    function renderHoy() {
        const h = hoy();
        const abiertas = S.tasks.filter(abierta);
        const atr = abiertas.filter(atrasada).sort(orden);
        const deHoy = abiertas.filter((t) => t.date === h);
        const semana = abiertas.filter((t) => t.date && t.date >= h && t.date <= domingo());
        const enCurso = abiertas.filter((t) => t.status === 'en_curso');
        const hechas = S.tasks.length - abiertas.length;
        const per = periodoDe(h);

        $('#titulo-dia').textContent = larga(h);
        let sub;
        if (!S.listo) sub = 'Cargando el plan desde Notion.';
        else if (per) sub = `Estás en ${per.label.toLowerCase()} (${corta(per.start)} al ${corta(per.end || per.start)}). Lo urgente puede esperar.`;
        else {
            const partes = [];
            partes.push(deHoy.length ? `${deHoy.length} ${deHoy.length === 1 ? 'tarea' : 'tareas'} para hoy` : 'Nada agendado para hoy');
            if (atr.length) partes.push(`${atr.length} ${atr.length === 1 ? 'atrasada' : 'atrasadas'}`);
            sub = partes.join(' y ') + '.';
        }
        $('#subtitulo-dia').textContent = sub;

        // Banda Hai Group con el próximo hito
        const hitos = S.tasks.filter((t) => t.milestone).sort(orden);
        const prox = hitos.find((t) => abierta(t) && t.date && t.date >= h) || hitos.find(abierta);
        const banda = $('#hito-contenido');
        if (prox) {
            const n = prox.date ? dif(h, prox.date) : null;
            banda.innerHTML = `<span class="num mono">Próximo hito · ${esc(modulo(prox.module).corto)}</span>
                <h2>${esc(prox.title)}</h2>
                <div class="banda-pie">
                    <div class="cuenta-regresiva">${n === null ? '' : n < 0 ? `<b>${-n}</b><span class="mono">días de atraso</span>` : `<b>${n}</b><span class="mono">${n === 1 ? 'día' : 'días'} · ${larga(prox.date)}</span>`}</div>
                    <button type="button" class="boton claro" data-accion="abrir" data-id="${esc(prox.id)}">Ver hito</button>
                </div>`;
        } else {
            banda.innerHTML = `<span class="num mono">Hai Group</span><h2>${S.listo ? 'No quedan hitos pendientes' : 'Cargando'}</h2>`;
        }

        // Avance del proyecto (arriba a la derecha)
        const pct = S.tasks.length ? Math.round((hechas / S.tasks.length) * 100) : 0;
        $('#avance').innerHTML = S.listo ? `<span class="mono gris">Avance del proyecto</span>
            <b>${pct}<small>%</small></b>
            <span class="avance-barra" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Avance del proyecto"><i style="--p:${pct}%"></i></span>
            <span class="mono gris">${hechas} de ${S.tasks.length} tareas hechas</span>` : '';

        // Indicadores: el cero se apaga, lo atrasado se enciende
        const kpi = (filtro, label, valor, alerta = false) =>
            `<button type="button" class="kpi${alerta ? ' alerta' : ''}${valor ? '' : ' cero'}" data-accion="filtro" data-filtro="${filtro}"><span class="kpi-et mono">${label}<span class="flecha" aria-hidden="true">→</span></span><span class="kpi-val">${valor}</span></button>`;
        $('#kpis').innerHTML =
            kpi('atrasadas', 'Atrasadas', atr.length, atr.length > 0) +
            kpi('semana', 'Esta semana', semana.length) +
            kpi('en_curso', 'En curso', enCurso.length);

        // Foco de hoy: atrasadas, hoy, en curso y prioritarias de los próximos 3 días
        const limite = sumar(h, 3);
        const foco = abiertas.filter((t) => atrasada(t) || t.date === h || t.status === 'en_curso' || (t.priority && t.date && t.date <= limite)).sort(orden);
        $('#foco-resumen').textContent = foco.length || '';
        $('#foco-resumen').hidden = !foco.length;
        $('#foco').innerHTML = lista(foco.slice(0, 10), S.listo ? 'Nada urgente. Buen día para adelantar.' : 'Cargando…') +
            (foco.length > 10 ? `<button type="button" class="link mono vacio" data-accion="filtro" data-filtro="todas">Ver las ${foco.length} en Tareas →</button>` : '');

        const enFoco = new Set(foco.map((t) => t.id));
        const prox7 = abiertas.filter((t) => t.date && t.date > h && t.date <= sumar(h, 7) && !enFoco.has(t.id)).sort(orden);
        $('#prox-resumen').textContent = prox7.length ? `${prox7.length} ${prox7.length === 1 ? 'tarea' : 'tareas'}` : '';
        $('#proximos').innerHTML = lista(prox7, 'Semana despejada.');

        // Hitos: los que vienen (máximo 6); el resto vive en Tareas
        const vienen = hitos.filter(abierta);
        const hechosH = hitos.length - vienen.length;
        const muestra = vienen.slice(0, 6);
        $('#hitos-todos').textContent = hitos.length ? `Ver los ${hitos.length}` : 'Ver todos';
        $('#hitos').innerHTML = (muestra.length ? muestra.map((t) => {
            const cls = t === prox ? 'proximo' : atrasada(t) ? 'atrasado' : '';
            return `<li><button type="button" class="hito ${cls}" data-accion="abrir" data-id="${esc(t.id)}">
                <span class="h-fecha mono">${t.date ? corta(t.date) : 'Sin fecha'}</span>
                <span class="h-titulo">${esc(t.title)}</span>
                <span class="h-falta mono">${t.date ? faltan(t.date) : ''}</span>
            </button></li>`;
        }).join('') : `<li class="vacio">${hitos.length ? 'Todos los hitos están hechos.' : 'Marca tareas como hito para verlas aquí.'}</li>`) +
            (hechosH || vienen.length > muestra.length ? `<li class="hitos-pie mono gris">${hechosH ? `${hechosH} ${hechosH === 1 ? 'hecho' : 'hechos'}` : ''}${hechosH && vienen.length > muestra.length ? ' · ' : ''}${vienen.length > muestra.length ? `${vienen.length - muestra.length} más adelante` : ''}</li>` : '');

        renderGantt();
        renderCarga();
    }

    function renderGantt() {
        const conFecha = S.tasks.filter((t) => t.date);
        const el = $('#gantt');
        if (!conFecha.length) { el.innerHTML = '<p class="vacio">Sin tareas con fecha.</p>'; $('#leyenda-gantt').innerHTML = ''; return; }
        const fechas = conFecha.map((t) => t.date).sort();
        const h = hoy();
        const ini = lunes(fechas[0] < h ? fechas[0] : h);
        const ult = fechas[fechas.length - 1] > h ? fechas[fechas.length - 1] : h;
        const fin = sumar(ult, 10);
        const total = dif(ini, fin);
        const pos = (s) => (dif(ini, s) / total) * 100;

        let meses = '';
        let d = aFecha(ini); d.setDate(1);
        while (iso(d) <= fin) {
            const s = iso(d);
            if (s >= ini) meses += `<span class="g-mes mono" style="left:${pos(s)}%">${cap(MESES_C[d.getMonth()])}${d.getMonth() === 0 ? ` ${d.getFullYear()}` : ''}</span>`;
            d.setMonth(d.getMonth() + 1);
        }

        const capa = S.periodos.filter((p) => (p.end || p.start) >= ini && p.start <= fin).map((p) => {
            const a = p.start < ini ? ini : p.start, b = sumar(p.end || p.start, 1);
            return `<span class="g-periodo" style="left:${pos(a)}%;width:${pos(b) - pos(a)}%" title="${esc(p.label)}">${dif(a, b) >= 4 ? `<span class="mono">${esc(p.label)}</span>` : ''}</span>`;
        }).join('') + `<span class="g-hoy" style="left:${pos(h)}%"><span class="mono">Hoy</span></span>`;

        const filas = MODULOS.map((m) => {
            const ts = conFecha.filter((t) => t.module === m.id);
            if (!ts.length) return '';
            const fs = ts.map((t) => t.date).sort();
            const a = fs[0], b = sumar(fs[fs.length - 1], 1);
            const hh = ts.filter((t) => !abierta(t)).length;
            const hitos = ts.filter((t) => t.milestone).map((t) => `<span class="g-hito${abierta(t) ? '' : ' hecho'}" style="left:${pos(t.date) + (pos(sumar(t.date, 1)) - pos(t.date)) / 2}%" title="${esc(t.title)} · ${corta(t.date)}"></span>`).join('');
            return `<div class="g-fila">
                <button type="button" class="g-label" data-accion="modulo" data-modulo="${esc(m.id)}"><i class="dot" style="--c:${m.c}"></i><span class="g-nombre">${esc(m.corto)}</span><span class="g-cuenta mono${hh === ts.length ? ' completo' : ''}">${hh}/${ts.length}</span></button>
                <div class="g-pista">
                    <span class="g-barra" style="--c:${m.c};left:${pos(a)}%;width:${pos(b) - pos(a)}%" title="${esc(m.corto)}: ${corta(a)} al ${corta(fs[fs.length - 1])} · ${hh} de ${ts.length} hechas"><i style="--p:${(hh / ts.length) * 100}%"></i></span>
                    ${hitos}
                </div>
            </div>`;
        }).join('');

        el.innerHTML = `<div class="g-tabla"><div class="g-meses">${meses}</div><div class="g-capa">${capa}</div>${filas}</div>`;
        $('#leyenda-gantt').innerHTML = '<span><i class="sw" style="--c:var(--teal-700)"></i>Hecho</span><span><i class="sw pendiente" style="--c:var(--teal-700)"></i>Pendiente</span><span><i class="sw rombo"></i>Hito</span><span><i class="sw rayado"></i>No disponible</span><span><i class="sw linea"></i>Hoy</span>';
    }

    function renderCarga() {
        const h = hoy();
        const ini = sumar(lunes(h), -7);
        const fechas = S.tasks.filter((t) => t.date && t.date >= ini).map((t) => t.date).sort();
        const finTareas = fechas.length ? lunes(fechas[fechas.length - 1]) : lunes(h);
        const semanas = [];
        for (let s = ini; s <= finTareas && semanas.length < 20; s = sumar(s, 7)) semanas.push(s);
        while (semanas.length < 8) semanas.push(sumar(semanas[semanas.length - 1], 7));

        const datos = semanas.map((s) => {
            const fin = sumar(s, 6);
            const ts = S.tasks.filter((t) => t.date && t.date >= s && t.date <= fin);
            const libre = S.periodos.some((p) => p.start <= fin && (p.end || p.start) >= s);
            return { s, libre, atr: ts.filter(atrasada).length, pend: ts.filter((t) => abierta(t) && !atrasada(t)).length, hechas: ts.filter((t) => !abierta(t)).length };
        });
        const max = Math.max(4, ...datos.map((x) => x.atr + x.pend + x.hechas));
        const u = 168 / max;
        $('#carga').innerHTML = datos.map((x) => {
            const actual = x.s === lunes(h);
            const total = x.atr + x.pend + x.hechas;
            return `<button type="button" class="semana${x.libre ? ' libre' : ''}${actual ? ' actual' : ''}" data-accion="semana" data-semana="${x.s}" title="Semana del ${corta(x.s)}: ${x.pend + x.atr} abiertas, ${x.hechas} hechas" style="--u:${u}px">
                <span class="pila">
                    ${total ? `<span class="total mono">${total}</span>` : ''}
                    ${x.pend ? `<i class="seg" style="--n:${x.pend};--c:var(--teal-700)"></i>` : ''}
                    ${x.atr ? `<i class="seg" style="--n:${x.atr};--c:var(--rojo)"></i>` : ''}
                    ${x.hechas ? `<i class="seg" style="--n:${x.hechas};--c:var(--gris-claro)"></i>` : ''}
                </span>
                <span class="etq mono">${actual ? 'Esta' : corta(x.s)}</span>
            </button>`;
        }).join('');
    }

    // --- 9. VISTA TAREAS ---
    function grupos(arr) {
        const h = hoy(), dom = domingo(), dom2 = sumar(dom, 7);
        const g = new Map();
        const add = (k, titulo, t, cls = '') => { if (!g.has(k)) g.set(k, { k, titulo, cls, items: [] }); g.get(k).items.push(t); };
        for (const t of arr) {
            if (!abierta(t)) add('z', 'Hechas', t, 'hechas');
            else if (!t.date) add('y', 'Sin fecha', t);
            else if (t.date < h) add('a', 'Atrasadas', t, 'atrasadas');
            else if (t.date === h) add('b', 'Hoy', t);
            else if (t.date <= dom) add('c', 'Esta semana', t);
            else if (t.date <= dom2) add('d', 'Próxima semana', t);
            else add('m' + t.date.slice(0, 7), mesLargo(t.date.slice(0, 7)), t);
        }
        return [...g.values()].sort((a, b) => a.k.localeCompare(b.k));
    }

    function renderTareas() {
        // Opciones de módulo (una vez)
        const opciones = MODULOS.map((m) => `<option value="${esc(m.id)}">${esc(m.corto)}</option>`).join('');
        if (!$('#rapida-cat').options.length) {
            $('#rapida-cat').innerHTML = opciones;
            $('#rapida-cat').value = prefs.ultimaCat || MOD_DEFECTO;
            $('#filtro-cat').innerHTML = '<option value="">Todos los módulos</option>' + opciones;
        }
        if (!$('#rapida-fecha').value) $('#rapida-fecha').value = hoy();
        $('#filtro-cat').value = S.cat;
        $('#ocultar-hechas').checked = S.ocultarHechas;
        if ($('#buscar').value !== S.buscar) $('#buscar').value = S.buscar;

        const base = S.tasks.filter((t) => (!S.cat || t.module === S.cat));
        $('#vistas-rapidas').innerHTML = FILTROS.map((f) => {
            const n = base.filter(f.cuenta || f.f).length;
            if (f.id !== 'todas' && f.id !== S.filtro && !n) return '';
            return `<button type="button" class="chip${f.rojo && n ? ' rojo' : ''}" aria-pressed="${S.filtro === f.id}" data-accion="filtro" data-filtro="${f.id}" data-quedarse>${f.txt}<span class="n">${n}</span></button>`;
        }).join('');

        const filtro = FILTROS.find((f) => f.id === S.filtro) || FILTROS[0];
        const q = norma(S.buscar.trim());
        let arr = base.filter(filtro.f);
        if (q) arr = arr.filter((t) => norma(t.title + ' ' + t.notes + ' ' + modulo(t.module).corto).includes(q));
        if (S.ocultarHechas) arr = arr.filter(abierta);
        arr.sort(orden);

        const total = S.tasks.length, hechas = S.tasks.filter((t) => !abierta(t)).length, atr = S.tasks.filter(atrasada).length;
        $('#tareas-resumen').textContent = S.listo ? `${total} tareas en Notion · ${hechas} hechas${atr ? ` · ${atr} atrasadas` : ''}` : 'Cargando…';

        const gs = grupos(arr);
        if (!gs.length) {
            const hayFiltros = S.filtro !== 'todas' || S.cat || q || S.ocultarHechas;
            $('#lista-tareas').innerHTML = `<p class="vacio">${S.listo ? 'Nada por aquí.' : 'Cargando…'} ${hayFiltros ? '<button type="button" class="link" data-accion="limpiar">Quitar filtros</button>' : ''}</p>`;
            return;
        }
        $('#lista-tareas').innerHTML = gs.map((g) => {
            const items = g.k === 'z' ? g.items.sort((a, b) => (b.date || '').localeCompare(a.date || '')) : g.items;
            const cabeza = `<h2>${esc(g.titulo)}</h2><span class="mono gris">${items.length}</span>`;
            const cuerpo = `<div class="lista">${items.map((t) => fila(t, { sinModulo: !!S.cat })).join('')}</div>`;
            if (g.k === 'z') {
                const abrir = q || S.filtro === 'hitos' || gs.length === 1;
                return `<details class="grupo hechas"${abrir ? ' open' : ''}><summary class="grupo-cabeza">${cabeza}</summary>${cuerpo}</details>`;
            }
            return `<section class="grupo ${g.cls}"><div class="grupo-cabeza">${cabeza}</div>${cuerpo}</section>`;
        }).join('');
    }

    // --- 10. VISTA CALENDARIO ---
    function renderCalendario() {
        const [y, m] = S.mes.split('-').map(Number);
        $('#cal-titulo').textContent = `${cap(MESES[m - 1])} ${y}`;
        const primero = `${S.mes}-01`;
        const ultimo = iso(new Date(y, m, 0, 12));
        const ini = lunes(primero);
        const semanas = Math.ceil((dif(ini, ultimo) + 1) / 7);
        const h = hoy();

        const porDia = {};
        for (const t of S.tasks) if (t.date) (porDia[t.date] = porDia[t.date] || []).push(t);

        let celdas = '';
        for (let i = 0; i < semanas * 7; i++) {
            const s = sumar(ini, i);
            const ts = (porDia[s] || []).sort(orden);
            const per = periodoDe(s);
            const dow = aFecha(s).getDay();
            const cls = ['celda'];
            if (s.slice(0, 7) !== S.mes) cls.push('fuera');
            if (s === h) cls.push('hoy');
            if (s === S.dia) cls.push('sel');
            if (per) cls.push('periodo');
            if (dow === 0 || dow === 6) cls.push('finde');
            const etq = per && (s === per.start || dow === 1 || s === primero) ? `<span class="p-etq mono">${esc(per.label)}</span>` : '';
            const chips = ts.slice(0, 3).map((t) => `<button type="button" class="chip-cal${!abierta(t) ? ' hecha' : ''}${atrasada(t) ? ' atrasada' : ''}${t.milestone ? ' hito' : ''}" draggable="${t.tmp ? 'false' : 'true'}" data-accion="abrir" data-id="${esc(t.id)}" style="--c:${modulo(t.module).c}" title="${esc(t.title)}">${esc(t.title)}</button>`).join('');
            const mas = ts.length > 3 ? `<span class="mas-cal mono">+${ts.length - 3} más</span>` : '';
            const puntos = ts.length ? `<span class="puntos">${ts.slice(0, 8).map((t) => `<i style="--c:${!abierta(t) ? 'var(--gris-claro)' : modulo(t.module).c}"></i>`).join('')}</span>` : '';
            celdas += `<div class="${cls.join(' ')}" data-dia="${s}">
                <div class="dnum"><b role="button" tabindex="0" data-accion="dia" data-dia="${s}" aria-label="${larga(s)}">${aFecha(s).getDate()}</b>${etq}</div>
                ${chips}${mas}${puntos}
            </div>`;
        }
        $('#cal').innerHTML = `<div class="cal-dias mono">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => `<span>${d}</span>`).join('')}</div><div class="cal-grilla">${celdas}</div>`;

        // Panel del día
        const per = periodoDe(S.dia);
        $('#dia-titulo').textContent = larga(S.dia);
        $('#dia-periodo').textContent = per ? `${per.label} · ${corta(per.start)} al ${corta(per.end || per.start)}` : '';
        $('#dia-lista').innerHTML = lista((porDia[S.dia] || []).sort(orden), 'Sin tareas este día.');
    }

    // --- 11. VISTA PAGOS ---
    function renderPagos() {
        const ps = S.pagos;
        if (!ps.length) {
            $('#pago-kpis').innerHTML = '';
            $('#pagos-grafico').innerHTML = `<p class="vacio">${S.listo ? 'No llegan pagos. Revisa que la página privada esté conectada a la integración de Notion (README, paso 2).' : 'Cargando…'}</p>`;
            $('#pagos-meses')?.remove();
            $('#pagos-cuerpo').innerHTML = '';
            $('#pagos-pie').innerHTML = '';
            $('#pagos-notas').innerHTML = '';
            return;
        }
        const calc = (p) => { const ret = Math.round(p.bruto * p.tasa / 100); return { ret, neto: p.bruto - ret }; };
        const tot = ps.reduce((a, p) => { const c = calc(p); a.bruto += p.bruto; a.ret += c.ret; a.neto += c.neto; return a; }, { bruto: 0, ret: 0, neto: 0 });
        const pagadas = ps.filter((p) => p.estado === 'pagada');
        const cobrado = pagadas.reduce((a, p) => a + calc(p).neto, 0);

        // La próxima boleta es la primera que no está pagada: es lo que hay que mirar
        const proxima = ps.find((p) => p.estado !== 'pagada');
        const corto = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(2).replace('.', ',')} M` : `${Math.round(n / 1000)} mil`;

        const k = (label, valor, extra = '', cls = '') => `<div class="kpi${cls}"><span class="kpi-et mono">${label}</span><span class="kpi-val">${valor}</span>${extra ? `<span class="kpi-extra mono">${extra}</span>` : ''}</div>`;
        $('#pago-kpis').innerHTML =
            (proxima ? k(`Próxima boleta · ${mesLargo(proxima.mes)}`, clp(calc(proxima).neto), `${proxima.estado === 'emitida' ? 'Emitida' : 'Por emitir'} · llega ${esc((proxima.deposito || '').toLowerCase()) || 'al mes siguiente'}`, ' destacado') : k('Próxima boleta', 'Todo pagado', '', ' destacado')) +
            k('Te llega en el año', clp(tot.neto), `de ${clp(tot.bruto)} en boletas`) +
            k('Retención', clp(tot.ret), 'vuelve en abril') +
            k('Cobrado', clp(cobrado), `${pagadas.length} de ${ps.length} boletas`);

        const max = Math.max(...ps.map((p) => calc(p).neto));
        const graf = $('#pagos-grafico');
        graf.style.setProperty('--n', ps.length);
        graf.innerHTML = ps.map((p) => {
            const c = calc(p);
            const cls = p.estado === 'pagada' ? 'pagada' : p.estado === 'emitida' ? 'emitida' : 'por-emitir';
            return `<div class="pg ${cls}${p === proxima ? ' proxima' : ''}" title="${mesLargo(p.mes)}: ${clp(c.neto)} líquido · ${p.estado}"><span class="monto mono">${corto(c.neto)}</span><span class="barra-pago" style="--h:${(c.neto / max) * 150}px"></span></div>`;
        }).join('');
        let meses = $('#pagos-meses');
        if (!meses) { meses = document.createElement('div'); meses.id = 'pagos-meses'; meses.className = 'pagos-meses mono'; graf.after(meses); }
        meses.style.setProperty('--n', ps.length);
        meses.innerHTML = ps.map((p) => { const [y, m] = p.mes.split('-').map(Number); return `<span${p === proxima ? ' class="actual"' : ''}>${cap(MESES_C[m - 1])}${m === 1 || p === ps[0] ? ` ${String(y).slice(2)}` : ''}</span>`; }).join('');

        $('#pagos-cuerpo').innerHTML = ps.map((p) => {
            const c = calc(p);
            const dep = p.estado === 'pagada' && p.pagadaEl ? `Pagada el ${corta(p.pagadaEl)}` : p.deposito || '';
            return `<tr${p === proxima ? ' class="actual"' : ''}>
                <td>${mesLargo(p.mes)}</td>
                <td class="n">${clp(p.bruto)}</td>
                <td class="n">${clp(c.ret)} <span class="gris mono">${String(p.tasa).replace('.', ',')}%</span></td>
                <td class="n"><b>${clp(c.neto)}</b></td>
                <td class="mono">${esc(dep)}</td>
                <td><select class="estado-pago" data-pago="${esc(p.id)}" data-v="${esc(p.estado)}" aria-label="Estado de la boleta de ${mesLargo(p.mes)}">
                    ${['por emitir', 'emitida', 'pagada'].map((e) => `<option value="${e}"${e === p.estado ? ' selected' : ''}>${cap(e)}</option>`).join('')}
                </select></td>
            </tr>`;
        }).join('');
        $('#pagos-pie').innerHTML = `<tr><td>Total</td><td class="n">${clp(tot.bruto)}</td><td class="n">${clp(tot.ret)}</td><td class="n">${clp(tot.neto)}</td><td></td><td></td></tr>`;

        // Notas calculadas desde Notion (así el código no guarda montos)
        const ultimo = ps[ps.length - 1];
        const fijo = calc(ultimo).neto;
        const desde = ps.find((p) => p.bruto === ultimo.bruto);
        const altos = ps.filter((p) => calc(p).neto > fijo);
        const sobra = altos.reduce((a, p) => a + calc(p).neto - fijo, 0);
        $('#pagos-notas').innerHTML = `
            <div><span class="num mono">Regla</span><p>Vive con <b>${clp(fijo)} al mes</b>, lo que queda fijo desde ${MESES[+desde.mes.slice(5) - 1]}.${altos.length ? ` Lo que sobra de ${MESES[+altos[0].mes.slice(5) - 1]} a ${MESES[+altos[altos.length - 1].mes.slice(5) - 1]} (<b>${clp(sobra)}</b>) va al fondo de emergencia.` : ''}</p></div>
            <div><span class="num mono">Retención</span><p>En la Operación Renta de abril se usa para tus cotizaciones. Con este ingreso, el impuesto debería ser cero o muy bajo.</p></div>
            <div><span class="num mono">Campañas</span><p>Se suman a la boleta del mes en que se activan. No entran al presupuesto hasta que existan.</p></div>`;
    }

    // --- 12. RENDER Y NAVEGACIÓN ---
    function render() {
        const atr = S.tasks.filter(atrasada).length;
        const c = $('#cuenta-atrasadas');
        c.hidden = !atr;
        c.textContent = atr;
        $('#alerta-tab').hidden = !atr;
        if (S.vista === 'hoy') renderHoy();
        else if (S.vista === 'tareas') renderTareas();
        else if (S.vista === 'calendario') renderCalendario();
        else if (S.vista === 'pagos') renderPagos();
    }

    function mostrarVista() {
        const v = location.hash.slice(1);
        const nueva = VISTAS.includes(v) ? v : 'hoy';
        const cambio = nueva !== S.vista;
        S.vista = nueva;
        $$('.vista').forEach((el) => { el.hidden = el.dataset.vista !== nueva; });
        $$('a[data-vista]').forEach((a) => { if (a.dataset.vista === nueva) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
        document.title = `${NOMBRES[nueva]} · Plan Hai Group`;
        render();
        if (cambio) window.scrollTo(0, 0);
    }
    const ir = (v) => { if (location.hash.slice(1) === v) mostrarVista(); else location.hash = v; };

    // --- 13. EDITOR ---
    let focoPrevio = null;
    function abrirEditor(id, base = {}) {
        const t = id ? buscarTarea(id) : null;
        if (id && (!t || t.tmp)) return;
        S.editando = t ? t.id : 'nueva';
        focoPrevio = document.activeElement;
        const sel = $('#t-cat');
        if (!sel.options.length) sel.innerHTML = MODULOS.map((m) => `<option value="${esc(m.id)}">${esc(m.id)}</option>`).join('');
        $('#editor-titulo').textContent = t ? `Editar · ${modulo(t.module).corto}` : 'Nueva tarea';
        $('#t-titulo').value = t ? t.title : '';
        $('#t-fecha').value = t ? t.date || '' : base.date || hoy();
        sel.value = t ? t.module : base.module || prefs.ultimaCat || MOD_DEFECTO;
        const estado = t ? t.status : 'pendiente';
        $$('#t-estado input').forEach((r) => { r.checked = r.value === estado; });
        $('#t-prioritaria').checked = t ? t.priority : false;
        $('#t-hito').checked = t ? t.milestone : false;
        $('#t-notas').value = t ? t.notes : '';
        $('#t-notion').hidden = !(t && t.url);
        if (t && t.url) $('#t-notion').href = t.url;
        $('#t-borrar').hidden = !t;
        $('#t-guardar').textContent = t ? 'Guardar' : 'Crear tarea';
        $('#editor-error').hidden = true;
        $('#velo').hidden = false;
        $('#editor').hidden = false;
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => { const ta = $('#t-titulo'); ta.focus(); if (t) ta.setSelectionRange(ta.value.length, ta.value.length); });
    }

    function cerrarEditor() {
        if (!S.editando) return;
        S.editando = null;
        $('#velo').hidden = true;
        $('#editor').hidden = true;
        document.body.style.overflow = '';
        if (focoPrevio && document.contains(focoPrevio)) focoPrevio.focus({ preventScroll: true });
    }

    function guardarEditor(e) {
        e.preventDefault();
        const title = $('#t-titulo').value.trim().replace(/\s+/g, ' ');
        if (!title) { const er = $('#editor-error'); er.textContent = 'La tarea necesita un nombre'; er.hidden = false; $('#t-titulo').focus(); return; }
        const datos = {
            title,
            date: $('#t-fecha').value || null,
            module: $('#t-cat').value,
            status: ($('#t-estado input:checked') || {}).value || 'pendiente',
            priority: $('#t-prioritaria').checked,
            milestone: $('#t-hito').checked,
            notes: $('#t-notas').value.trim(),
        };
        prefs.ultimaCat = datos.module;
        guardarPrefs();
        const id = S.editando;
        cerrarEditor();
        if (id === 'nueva') { crear(datos); return; }
        const t = buscarTarea(id);
        if (!t) return;
        const patch = {};
        for (const k in datos) if ((t[k] ?? null) !== (datos[k] ?? null) && !(k === 'notes' && (t.notes || '') === datos.notes)) patch[k] = datos[k];
        if (Object.keys(patch).length) actualizar(id, patch, { mensaje: 'Guardado en Notion' });
    }

    // --- 14. EVENTOS ---
    function accion(el, e) {
        const id = el.dataset.id || el.closest('[data-id]')?.dataset.id;
        switch (el.dataset.accion) {
            case 'hecha': alternarHecha(id); break;
            case 'abrir': abrirEditor(id); break;
            case 'd1': mover(id, 1); break;
            case 'd7': mover(id, 7); break;
            case 'filtro':
                S.filtro = el.dataset.filtro;
                if (!el.hasAttribute('data-quedarse')) { S.cat = ''; S.buscar = ''; }
                guardarPrefs();
                if (S.vista === 'tareas') render(); else ir('tareas');
                break;
            case 'modulo':
                S.cat = el.dataset.modulo; S.filtro = 'todas'; S.buscar = '';
                guardarPrefs();
                ir('tareas');
                break;
            case 'semana':
                S.dia = el.dataset.semana; S.mes = S.dia.slice(0, 7);
                ir('calendario');
                break;
            case 'dia':
                seleccionarDia(el.dataset.dia);
                break;
            case 'limpiar':
                S.filtro = 'todas'; S.cat = ''; S.buscar = ''; S.ocultarHechas = false;
                guardarPrefs(); render();
                break;
        }
        e.preventDefault();
    }

    function seleccionarDia(s) {
        S.dia = s;
        if (s.slice(0, 7) !== S.mes) S.mes = s.slice(0, 7);
        renderCalendario();
        if (window.matchMedia('(max-width: 960px)').matches) $('#dia-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function enlazar() {
        document.addEventListener('click', (e) => {
            const el = e.target.closest('[data-accion]');
            if (el) return accion(el, e);
            if (e.target.closest('[data-nueva]')) return abrirEditor(null);
            const celda = e.target.closest('.celda');
            if (celda) seleccionarDia(celda.dataset.dia);
        });
        // Elementos con role="button" que no son <button>
        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-accion]')) { e.preventDefault(); accion(e.target, e); }
        });

        window.addEventListener('hashchange', mostrarVista);
        $('#sync').addEventListener('click', () => { S.error = null; cargar(); });
        $('#salir').addEventListener('click', () => salir());

        // Captura rápida
        $('#rapida').addEventListener('submit', (e) => {
            e.preventDefault();
            const input = $('#rapida-titulo');
            const title = input.value.trim().replace(/\s+/g, ' ');
            if (!title) return;
            const module = $('#rapida-cat').value;
            prefs.ultimaCat = module; guardarPrefs();
            crear({ title, date: $('#rapida-fecha').value || null, module });
            input.value = '';
            input.focus();
        });

        // Filtros
        let t;
        $('#buscar').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { S.buscar = e.target.value; renderTareas(); }, 120); });
        $('#filtro-cat').addEventListener('change', (e) => { S.cat = e.target.value; guardarPrefs(); renderTareas(); });
        $('#ocultar-hechas').addEventListener('change', (e) => { S.ocultarHechas = e.target.checked; guardarPrefs(); renderTareas(); });

        // Calendario
        const cambiarMes = (n) => { const [y, m] = S.mes.split('-').map(Number); const d = new Date(y, m - 1 + n, 1, 12); S.mes = iso(d).slice(0, 7); renderCalendario(); };
        $('#cal-prev').addEventListener('click', () => cambiarMes(-1));
        $('#cal-next').addEventListener('click', () => cambiarMes(1));
        $('#cal-hoy').addEventListener('click', () => { S.mes = hoy().slice(0, 7); S.dia = hoy(); renderCalendario(); });
        $('#dia-nueva').addEventListener('click', () => abrirEditor(null, { date: S.dia }));

        // Arrastrar y soltar en el calendario
        const cal = $('#cal');
        let arrastrado = null;
        cal.addEventListener('dragstart', (e) => {
            const chip = e.target.closest('.chip-cal');
            if (!chip) return;
            arrastrado = chip.dataset.id;
            chip.classList.add('arrastrando');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', arrastrado);
        });
        cal.addEventListener('dragend', (e) => { e.target.closest('.chip-cal')?.classList.remove('arrastrando'); $$('.celda.sobre').forEach((c) => c.classList.remove('sobre')); arrastrado = null; });
        cal.addEventListener('dragover', (e) => {
            const celda = e.target.closest('.celda');
            if (!celda || !arrastrado) return;
            e.preventDefault();
            if (!celda.classList.contains('sobre')) { $$('.celda.sobre').forEach((c) => c.classList.remove('sobre')); celda.classList.add('sobre'); }
        });
        cal.addEventListener('drop', (e) => {
            const celda = e.target.closest('.celda');
            if (!celda || !arrastrado) return;
            e.preventDefault();
            const id = arrastrado, dia = celda.dataset.dia;
            const t = buscarTarea(id);
            arrastrado = null;
            if (t && t.date !== dia) { S.dia = dia; actualizar(id, { date: dia }, { mensaje: `Movida a ${larga(dia)}` }); }
        });

        // Pagos
        $('#pagos-cuerpo').addEventListener('change', (e) => {
            const s = e.target.closest('.estado-pago');
            if (s) cambiarPago(s.dataset.pago, s.value);
        });

        // Editor
        $('#form-tarea').addEventListener('submit', guardarEditor);
        $('#editor-cerrar').addEventListener('click', cerrarEditor);
        $('#velo').addEventListener('click', cerrarEditor);
        $('#t-borrar').addEventListener('click', () => { const id = S.editando; cerrarEditor(); borrar(id); });
        $('.atajos-fecha').addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            const f = $('#t-fecha');
            if (b.dataset.fecha !== undefined) f.value = sumar(hoy(), +b.dataset.fecha);
            else f.value = sumar(f.value || hoy(), +b.dataset.sumar);
        });
        $('#t-titulo').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) { e.preventDefault(); $('#form-tarea').requestSubmit(); } });

        // Teclado
        document.addEventListener('keydown', (e) => {
            if (S.editando) {
                if (e.key === 'Escape') { e.preventDefault(); cerrarEditor(); }
                else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); $('#form-tarea').requestSubmit(); }
                else if (e.key === 'Tab') atraparFoco(e);
                return;
            }
            if ($('#app').hidden) return;
            const campo = e.target.closest('input, textarea, select, [contenteditable="true"]');
            if (campo) { if (e.key === 'Escape') campo.blur(); return; }
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const k = e.key.toLowerCase();
            if (k === 'n') { e.preventDefault(); abrirEditor(null, S.vista === 'calendario' ? { date: S.dia } : {}); }
            else if (k === '/') { e.preventDefault(); ir('tareas'); setTimeout(() => $('#buscar').focus(), 0); }
            else if (k === 'r') { S.error = null; cargar(); }
            else if (/^[1-5]$/.test(k)) ir(VISTAS[+k - 1]);
            else if (S.vista === 'calendario' && (k === 'arrowleft' || k === 'arrowright')) { e.preventDefault(); cambiarMes(k === 'arrowleft' ? -1 : 1); }
        });

        // Volver a leer Notion al volver a la pestaña y cada minuto
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - S.ultimaCarga > 15000) cargar(); });
        setInterval(() => { if (document.visibilityState === 'visible') cargar(); }, CADA);
        setInterval(reloj, 15000);
    }

    function atraparFoco(e) {
        const foco = $$('#editor button, #editor input, #editor select, #editor textarea, #editor a[href]').filter((el) => !el.hidden && !el.closest('[hidden]') && el.offsetParent !== null);
        if (!foco.length) return;
        const i = foco.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); foco[foco.length - 1].focus(); }
        else if (!e.shiftKey && i === foco.length - 1) { e.preventDefault(); foco[0].focus(); }
    }

    // --- 15. ACCESO ---
    function mostrarAcceso(mensaje) {
        $('#app').hidden = true;
        $('#acceso').hidden = false;
        document.title = 'Plan Hai Group';
        const er = $('#error-acceso');
        er.hidden = !mensaje;
        er.textContent = mensaje || '';
        if (!API) {
            $('#form-acceso').hidden = true;
            if (!$('.nota-config')) {
                $('#form-acceso').insertAdjacentHTML('afterend', `<div class="nota-config"><span class="mono etiqueta">Falta un paso</span><p>El panel todavía no está conectado con Notion. Sigue los pasos del <a href="${REPO}">README</a> y pega la URL de la función en <code>assets/js/config.js</code>.</p></div>`);
            }
            return;
        }
        setTimeout(() => $('#clave').focus(), 50);
    }

    function mostrarApp() {
        $('#acceso').hidden = true;
        $('#app').hidden = false;
        mostrarVista();
        reloj();
    }

    function salir(mensaje) {
        clave = '';
        quitar(K_CLAVE);
        quitar(K_CACHE);
        S.tasks = []; S.pagos = []; S.periodos = []; S.listo = false;
        cerrarEditor();
        mostrarAcceso(mensaje);
    }

    $('#form-acceso').addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = $('#clave').value.trim();
        if (!v) return;
        const b = $('#form-acceso button');
        b.disabled = true;
        b.textContent = 'Entrando';
        $('#error-acceso').hidden = true;
        clave = v;
        try {
            const d = await api('GET');
            guardar(K_CLAVE, v);
            $('#clave').value = '';
            mostrarApp();
            aplicar(d);
            guardarCache();
            sync();
        } catch (err) {
            clave = '';
            const er = $('#error-acceso');
            er.textContent = err.status === 401 ? 'Clave incorrecta' : `No pude conectar con la función: ${err.message}`;
            er.hidden = false;
        } finally {
            b.disabled = false;
            b.textContent = 'Entrar';
        }
    });

    // --- 16. INICIO ---
    enlazar();
    if (!API || !clave) {
        mostrarAcceso();
    } else {
        mostrarApp();
        try {
            const c = JSON.parse(leer(K_CACHE));
            if (c && c.tasks) { aplicar(c); sync('cache'); }
        } catch { /* caché dañada: se ignora */ }
        cargar();
    }
})();
