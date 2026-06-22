(function() {
    'use strict';

    const DB_NAME = 'RegAcadDB';
    const STORE_NAME = 'datos';
    const LS_FALLBACK_KEY = 'regacad_data';
    let db = null;
    let dbReady = false;
    let pendingSave = null;

    function openDB() {
        return new Promise(function(resolve, reject) {
            if (!window.indexedDB) { reject(new Error('IndexedDB no soportado')); return; }
            var req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = function(e) {
                var store = e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.put({ id: 'main', data: { estudiantes: [], tareas: [], evaluaciones: [], asistencia: [] } });
            };
            req.onsuccess = function(e) { resolve(e.target.result); };
            req.onerror = function(e) { reject(e.target.error); };
        });
    }

    function loadFromIDB() {
        return openDB().then(function(idb) {
            return new Promise(function(resolve, reject) {
                var tx = idb.transaction(STORE_NAME, 'readonly');
                var store = tx.objectStore(STORE_NAME);
                var req = store.get('main');
                req.onsuccess = function() {
                    var result = req.result;
                    idb.close();
                    resolve(result ? result.data : null);
                };
                req.onerror = function() { reject(req.error); idb.close(); };
            });
        });
    }

    function saveToIDB(data) {
        return openDB().then(function(idb) {
            return new Promise(function(resolve, reject) {
                var tx = idb.transaction(STORE_NAME, 'readwrite');
                var store = tx.objectStore(STORE_NAME);
                var req = store.put({ id: 'main', data: data });
                req.onsuccess = function() { resolve(); idb.close(); };
                req.onerror = function() { reject(req.error); idb.close(); };
            });
        });
    }

    function loadDB() {
        var empty = { estudiantes: [], tareas: [], evaluaciones: [], asistencia: [] };
        return loadFromIDB().then(function(data) {
            if (data) return data;
            try {
                var lsData = localStorage.getItem(LS_FALLBACK_KEY);
                if (lsData) {
                    var parsed = JSON.parse(lsData);
                    if (parsed && typeof parsed === 'object') {
                        saveToIDB(parsed).catch(function(){});
                        return parsed;
                    }
                }
            } catch (e) {}
            return empty;
        }).catch(function() {
            try {
                var lsData = localStorage.getItem(LS_FALLBACK_KEY);
                if (lsData) {
                    var parsed = JSON.parse(lsData);
                    if (parsed && typeof parsed === 'object') return parsed;
                }
            } catch (e) {}
            return empty;
        });
    }

    function saveDB() {
        if (!db) return;
        saveToIDB(db).catch(function() {
            try { localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(db)); } catch(e) {}
        });
        try { localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(db)); } catch(e) {}
    }

    function genId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function getEstudiante(id) {
        return db.estudiantes.find(e => e.id === id);
    }

    function getEstudianteNombre(id) {
        const e = getEstudiante(id);
        return e ? `${e.nombre} (${e.matricula})` : 'Desconocido';
    }

    // ===== ESTUDIANTES =====
    function addEstudiante(data) {
        if (!db) { showToast('Sistema inicializando...', 'error'); return; }
        const estudiante = {
            id: genId(),
            nombre: data.nombre.trim(),
            matricula: data.matricula.trim(),
            email: data.email.trim(),
            carrera: data.carrera.trim(),
            curso: data.curso,
            fechaRegistro: new Date().toISOString().split('T')[0]
        };
        db.estudiantes.push(estudiante);
        saveDB();
        renderAll();
        showToast('Estudiante registrado exitosamente', 'success');
    }

    function updateEstudiante(id, data) {
        if (!db) { showToast('Sistema inicializando...', 'error'); return; }
        const idx = db.estudiantes.findIndex(e => e.id === id);
        if (idx === -1) return;
        db.estudiantes[idx] = { ...db.estudiantes[idx], ...data };
        saveDB();
        renderAll();
        showToast('Estudiante actualizado', 'success');
    }

    function deleteEstudiante(id) {
        if (!db) return;
        if (!confirm('¿Eliminar este estudiante y todos sus datos asociados?')) return;
        db.estudiantes = db.estudiantes.filter(e => e.id !== id);
        db.tareas = db.tareas.filter(t => t.estudianteId !== id);
        db.evaluaciones = db.evaluaciones.filter(e => e.estudianteId !== id);
        db.asistencia = db.asistencia.filter(a => a.estudianteId !== id);
        saveDB();
        renderAll();
        showToast('Estudiante eliminado', 'info');
    }

    // ===== TAREAS =====
    function addTarea(data) {
        if (!db) { showToast('Sistema inicializando...', 'error'); return; }
        const tarea = {
            id: genId(),
            estudianteId: data.estudianteId,
            nombre: data.nombre.trim(),
            fecha: data.fecha,
            puntaje: parseFloat(data.puntaje)
        };
        db.tareas.push(tarea);
        saveDB();
        renderAll();
        showToast('Tarea registrada', 'success');
    }

    function updateTarea(id, data) {
        if (!db) return;
        const idx = db.tareas.findIndex(t => t.id === id);
        if (idx === -1) return;
        db.tareas[idx] = { ...db.tareas[idx], ...data };
        saveDB();
        renderAll();
        showToast('Tarea actualizada', 'success');
    }

    function deleteTarea(id) {
        if (!db) return;
        db.tareas = db.tareas.filter(t => t.id !== id);
        saveDB();
        renderAll();
        showToast('Tarea eliminada', 'info');
    }

    // ===== EVALUACIONES =====
    function addEvaluacion(data) {
        if (!db) { showToast('Sistema inicializando...', 'error'); return; }
        const evaluacion = {
            id: genId(),
            estudianteId: data.estudianteId,
            nombre: data.nombre.trim(),
            fecha: data.fecha,
            puntaje: parseFloat(data.puntaje)
        };
        db.evaluaciones.push(evaluacion);
        saveDB();
        renderAll();
        showToast('Evaluación registrada', 'success');
    }

    function updateEvaluacion(id, data) {
        if (!db) return;
        const idx = db.evaluaciones.findIndex(e => e.id === id);
        if (idx === -1) return;
        db.evaluaciones[idx] = { ...db.evaluaciones[idx], ...data };
        saveDB();
        renderAll();
        showToast('Evaluación actualizada', 'success');
    }

    function deleteEvaluacion(id) {
        if (!db) return;
        db.evaluaciones = db.evaluaciones.filter(e => e.id !== id);
        saveDB();
        renderAll();
        showToast('Evaluación eliminada', 'info');
    }

    // ===== ASISTENCIA =====
    function addAsistencia(data) {
        if (!db) { showToast('Sistema inicializando...', 'error'); return; }
        const asistencia = {
            id: genId(),
            estudianteId: data.estudianteId,
            fecha: data.fecha,
            estado: data.estado
        };
        db.asistencia.push(asistencia);
        saveDB();
        renderAll();
        showToast('Asistencia registrada', 'success');
    }

    function updateAsistencia(id, data) {
        if (!db) return;
        const idx = db.asistencia.findIndex(a => a.id === id);
        if (idx === -1) return;
        db.asistencia[idx] = { ...db.asistencia[idx], ...data };
        saveDB();
        renderAll();
        showToast('Asistencia actualizada', 'success');
    }

    function deleteAsistencia(id) {
        if (!db) return;
        db.asistencia = db.asistencia.filter(a => a.id !== id);
        saveDB();
        renderAll();
        showToast('Asistencia eliminada', 'info');
    }

    // ===== REPORTES =====
    function generarReporte(estudianteId, tipo) {
        const estudiante = getEstudiante(estudianteId);
        if (!estudiante) return;

        let items = [];
        if (tipo === 'completo' || tipo === 'tareas') {
            db.tareas.filter(t => t.estudianteId === estudianteId).forEach(t => {
                items.push({ tipo: 'Tarea', nombre: t.nombre, fecha: t.fecha, puntaje: t.puntaje });
            });
        }
        if (tipo === 'completo' || tipo === 'evaluaciones') {
            db.evaluaciones.filter(e => e.estudianteId === estudianteId).forEach(e => {
                items.push({ tipo: 'Evaluación', nombre: e.nombre, fecha: e.fecha, puntaje: e.puntaje });
            });
        }

        items.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        const totalPuntaje = items.reduce((sum, i) => sum + i.puntaje, 0);
        const promedio = items.length > 0 ? totalPuntaje / items.length : 0;

        const asistencias = db.asistencia.filter(a => a.estudianteId === estudianteId);
        const presentes = asistencias.filter(a => a.estado === 'Presente').length;
        const pctAsistencia = asistencias.length > 0 ? Math.round((presentes / asistencias.length) * 100) : 0;

        const numTareas = db.tareas.filter(t => t.estudianteId === estudianteId).length;
        const numEvaluaciones = db.evaluaciones.filter(e => e.estudianteId === estudianteId).length;

        return {
            estudiante,
            promedio: Math.round(promedio * 100) / 100,
            items,
            numTareas,
            numEvaluaciones,
            asistencias,
            pctAsistencia,
            totalAsistencias: asistencias.length
        };
    }

    function renderReporte(estudianteId, tipo) {
        const reporte = generarReporte(estudianteId, tipo);
        if (!reporte) {
            showToast('Seleccione un estudiante', 'error');
            return;
        }

        const resultado = document.getElementById('reporteResultado');
        resultado.classList.remove('hidden');

        document.getElementById('reporteTitulo').textContent = `Reporte de ${reporte.estudiante.nombre}`;

        document.getElementById('reporteInfoEstudiante').innerHTML = `
            <div><strong>Matrícula:</strong> ${reporte.estudiante.matricula}</div>
            <div><strong>Email:</strong> ${reporte.estudiante.email || '—'}</div>
            <div><strong>Carrera:</strong> ${reporte.estudiante.carrera || '—'}</div>
            <div><strong>Curso:</strong> ${reporte.estudiante.curso || '—'}</div>
        `;

        document.getElementById('statPromedio').textContent = reporte.promedio.toFixed(1);
        document.getElementById('statTareas').textContent = reporte.numTareas;
        document.getElementById('statEvaluaciones').textContent = reporte.numEvaluaciones;
        document.getElementById('statAsistencia').textContent = `${reporte.pctAsistencia}%`;

        const fill = document.getElementById('progressFill');
        const pct = Math.min(reporte.promedio, 100);
        fill.style.width = `${pct}%`;
        document.getElementById('progressText').textContent = `${reporte.promedio.toFixed(1)} / 100`;

        const detalleBody = document.getElementById('reporteDetalleBody');
        if (reporte.items.length === 0) {
            detalleBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--gray-500)">No hay calificaciones registradas.</td></tr>`;
        } else {
            detalleBody.innerHTML = reporte.items.map(i => `
                <tr>
                    <td><span class="badge ${i.tipo === 'Tarea' ? 'badge-success' : 'badge-warning'}">${i.tipo}</span></td>
                    <td>${escHtml(i.nombre)}</td>
                    <td>${i.fecha}</td>
                    <td class="${puntajeClass(i.puntaje)}">${i.puntaje.toFixed(1)}</td>
                </tr>
            `).join('');
        }

        const asisBody = document.getElementById('reporteAsistenciaBody');
        if (reporte.asistencias.length === 0) {
            asisBody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--gray-500)">No hay asistencias registradas.</td></tr>`;
        } else {
            asisBody.innerHTML = reporte.asistencias.map(a => `
                <tr>
                    <td>${a.fecha}</td>
                    <td><span class="badge ${a.estado === 'Presente' ? 'badge-success' : a.estado === 'Justificado' ? 'badge-warning' : 'badge-danger'}">${a.estado}</span></td>
                </tr>
            `).join('');
        }

        // Scroll to report
        resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ===== UTILS =====
    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function puntajeClass(p) {
        if (p >= 70) return 'puntaje-high';
        if (p >= 40) return 'puntaje-mid';
        return 'puntaje-low';
    }

    function showToast(msg, type) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type || 'info'}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function getToday() {
        return new Date().toISOString().split('T')[0];
    }

    // ===== RENDER =====
    function populateEstudianteSelects() {
        const selects = [
            'tareaEstudiante', 'evalEstudiante', 'asisEstudiante', 'reporteEstudiante',
            'filterTareaEstudiante', 'filterEvalEstudiante', 'filterAsisEstudiante'
        ];
        selects.forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const currentVal = sel.value;
            const isFilter = id.startsWith('filter');
            sel.innerHTML = isFilter ? `<option value="">${id.includes('Asis') || id.includes('Tarea') || id.includes('Eval') ? 'Todos los estudiantes' : 'Seleccionar estudiante...'}</option>` : '<option value="">Seleccionar estudiante...</option>';
            db.estudiantes.sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.id;
                opt.textContent = `${e.nombre} (${e.matricula})`;
                sel.appendChild(opt);
            });
            if (currentVal && [...sel.options].some(o => o.value === currentVal)) {
                sel.value = currentVal;
            }
        });
    }

    function renderEstudiantes() {
        const tbody = document.getElementById('estudiantesTableBody');
        const empty = document.getElementById('estudiantesEmpty');
        const search = (document.getElementById('searchEstudiantes').value || '').toLowerCase();

        let filtered = db.estudiantes;
        if (search) {
            filtered = filtered.filter(e =>
                e.nombre.toLowerCase().includes(search) ||
                e.matricula.toLowerCase().includes(search)
            );
        }

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        tbody.innerHTML = filtered.map(e => `
            <tr>
                <td><strong>${escHtml(e.matricula)}</strong></td>
                <td>${escHtml(e.nombre)}</td>
                <td>${escHtml(e.email) || '—'}</td>
                <td>${escHtml(e.carrera) || '—'}</td>
                <td><span class="badge badge-${e.curso ? 'success' : 'info'}">${escHtml(e.curso) || '—'}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="app.editEstudiante('${e.id}')">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteEstudiante('${e.id}')">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    function renderTareas() {
        const tbody = document.getElementById('tareasTableBody');
        const empty = document.getElementById('tareasEmpty');
        const filterEst = document.getElementById('filterTareaEstudiante').value;

        let filtered = [...db.tareas];
        if (filterEst) {
            filtered = filtered.filter(t => t.estudianteId === filterEst);
        }
        filtered.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        tbody.innerHTML = filtered.map(t => `
            <tr>
                <td>${escHtml(getEstudianteNombre(t.estudianteId))}</td>
                <td>${escHtml(t.nombre)}</td>
                <td>${t.fecha}</td>
                <td class="${puntajeClass(t.puntaje)}">${t.puntaje.toFixed(1)}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="app.editTarea('${t.id}')">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteTarea('${t.id}')">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    function renderEvaluaciones() {
        const tbody = document.getElementById('evaluacionesTableBody');
        const empty = document.getElementById('evaluacionesEmpty');
        const filterEst = document.getElementById('filterEvalEstudiante').value;

        let filtered = [...db.evaluaciones];
        if (filterEst) {
            filtered = filtered.filter(e => e.estudianteId === filterEst);
        }
        filtered.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        tbody.innerHTML = filtered.map(e => `
            <tr>
                <td>${escHtml(getEstudianteNombre(e.estudianteId))}</td>
                <td>${escHtml(e.nombre)}</td>
                <td>${e.fecha}</td>
                <td class="${puntajeClass(e.puntaje)}">${e.puntaje.toFixed(1)}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="app.editEvaluacion('${e.id}')">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteEvaluacion('${e.id}')">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    function renderAsistencia() {
        const tbody = document.getElementById('asistenciaTableBody');
        const empty = document.getElementById('asistenciaEmpty');
        const filterEst = document.getElementById('filterAsisEstudiante').value;
        const filterFecha = document.getElementById('filterAsisFecha').value;

        let filtered = [...db.asistencia];
        if (filterEst) filtered = filtered.filter(a => a.estudianteId === filterEst);
        if (filterFecha) filtered = filtered.filter(a => a.fecha === filterFecha);
        filtered.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        tbody.innerHTML = filtered.map(a => `
            <tr>
                <td>${escHtml(getEstudianteNombre(a.estudianteId))}</td>
                <td>${a.fecha}</td>
                <td><span class="badge ${a.estado === 'Presente' ? 'badge-success' : a.estado === 'Justificado' ? 'badge-warning' : 'badge-danger'}">${a.estado}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="app.editAsistencia('${a.id}')">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteAsistencia('${a.id}')">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    function renderAsistenciaRapida() {
        var tbody = document.getElementById('asistenciaRapidaBody');
        var empty = document.getElementById('asistenciaRapidaEmpty');
        var filterCurso = document.getElementById('rapidaCurso').value;
        var fecha = document.getElementById('rapidaFecha').value;

        var estudiantes = db.estudiantes;
        if (filterCurso) {
            estudiantes = estudiantes.filter(function(e) { return e.curso === filterCurso; });
        }
        estudiantes.sort(function(a, b) { return a.nombre.localeCompare(b.nombre); });

        if (estudiantes.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        var existingAsistencia = [];
        if (fecha) {
            existingAsistencia = db.asistencia.filter(function(a) { return a.fecha === fecha; });
        }

        tbody.innerHTML = estudiantes.map(function(e) {
            var existing = existingAsistencia.find(function(a) { return a.estudianteId === e.id; });
            return '<tr>' +
                '<td><strong>' + escHtml(e.matricula) + '</strong></td>' +
                '<td>' + escHtml(e.nombre) + '</td>' +
                '<td><span class="badge badge-success">' + escHtml(e.curso) + '</span></td>' +
                '<td>' +
                '<div class="radio-group" data-estudiante="' + e.id + '">' +
                '<label class="opt-presente"><input type="radio" name="asis_' + e.id + '" value="Presente"' + (existing && existing.estado === 'Presente' ? ' checked' : '') + '> P</label>' +
                '<label class="opt-ausente"><input type="radio" name="asis_' + e.id + '" value="Ausente"' + (existing && existing.estado === 'Ausente' ? ' checked' : '') + '> A</label>' +
                '<label class="opt-justificado"><input type="radio" name="asis_' + e.id + '" value="Justificado"' + (existing && existing.estado === 'Justificado' ? ' checked' : '') + '> J</label>' +
                (existing ? '<span style="font-size:0.7rem;color:var(--gray-500);margin-left:6px;">(guardado)</span>' : '<span style="font-size:0.7rem;color:var(--gray-400);margin-left:6px;">(pendiente)</span>') +
                '</div>' +
                '</td>' +
                '</tr>';
        }).join('');
    }

    function renderAll() {
        populateEstudianteSelects();
        renderEstudiantes();
        renderTareas();
        renderEvaluaciones();
        renderAsistencia();
        renderAsistenciaRapida();
    }

    // ===== ACTIVIDAD POR CURSO =====
    function calcularActividad(curso) {
        var estudiantes = db.estudiantes.filter(function(e) { return e.curso === curso; });
        estudiantes.sort(function(a, b) { return a.nombre.localeCompare(b.nombre); });

        return estudiantes.map(function(est) {
            var asistencias = db.asistencia.filter(function(a) { return a.estudianteId === est.id && a.estado === 'Presente'; }).length;
            var tareas = db.tareas.filter(function(t) { return t.estudianteId === est.id; }).length;
            var evaluaciones = db.evaluaciones.filter(function(e) { return e.estudianteId === est.id; }).length;

            var ptsAsistencia = Math.round(asistencias * 4.2 * 100) / 100;
            var ptsTareas = Math.round(tareas * 1.8 * 100) / 100;
            var ptsEvaluaciones = Math.round(evaluaciones * 10 * 100) / 100;
            var total = Math.round((ptsAsistencia + ptsTareas + ptsEvaluaciones) * 100) / 100;

            return {
                estudiante: est,
                countAsistencia: asistencias,
                countTareas: tareas,
                countEvaluaciones: evaluaciones,
                ptsAsistencia: ptsAsistencia,
                ptsTareas: ptsTareas,
                ptsEvaluaciones: ptsEvaluaciones,
                total: total
            };
        });
    }

    function renderActividad() {
        var curso = document.getElementById('actividadCurso').value;
        var resultados = calcularActividad(curso);
        var tbody = document.getElementById('actividadTableBody');
        var empty = document.getElementById('actividadEmpty');
        var titulo = document.getElementById('actividadTitulo');

        titulo.textContent = 'Actividad - Curso ' + curso;

        if (resultados.length === 0) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
        empty.style.display = 'none';

        tbody.innerHTML = resultados.map(function(r, i) {
            return '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td><strong>' + escHtml(r.estudiante.matricula) + '</strong></td>' +
                '<td>' + escHtml(r.estudiante.nombre) + '</td>' +
                '<td>' + r.countAsistencia + ' × 4.2 = <strong>' + r.ptsAsistencia.toFixed(1) + '</strong></td>' +
                '<td>' + r.countTareas + ' × 1.8 = <strong>' + r.ptsTareas.toFixed(1) + '</strong></td>' +
                '<td>' + r.countEvaluaciones + ' × 10 = <strong>' + r.ptsEvaluaciones.toFixed(1) + '</strong></td>' +
                '<td><strong>' + r.total.toFixed(1) + '</strong></td>' +
                '</tr>';
        }).join('');
    }

    function exportActividadExcel() {
        var curso = document.getElementById('actividadCurso').value;
        var resultados = calcularActividad(curso);
        if (resultados.length === 0) { showToast('No hay datos', 'error'); return; }

        var html = '<table><tr><th>N°</th><th>Matrícula</th><th>Nombre</th><th>Asistencia</th><th>Tareas</th><th>Evaluaciones</th><th>Total</th></tr>';
        resultados.forEach(function(r, i) {
            html += '<tr><td>' + (i+1) + '</td><td>' + r.estudiante.matricula + '</td><td>' + r.estudiante.nombre +
                '</td><td>' + r.ptsAsistencia.toFixed(1) + '</td><td>' + r.ptsTareas.toFixed(1) +
                '</td><td>' + r.ptsEvaluaciones.toFixed(1) + '</td><td>' + r.total.toFixed(1) + '</td></tr>';
        });
        html += '</table>';

        var blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'actividad_curso_' + curso + '_' + getToday() + '.xls';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Excel exportado', 'success');
    }

    function exportActividadPDF() {
        var curso = document.getElementById('actividadCurso').value;
        var resultados = calcularActividad(curso);
        if (resultados.length === 0) { showToast('No hay datos', 'error'); return; }

        var win = window.open('', '_blank');
        win.document.write('<html><head><title>Actividad Curso ' + curso + '</title>');
        win.document.write('<style>body{font-family:Arial,sans-serif;padding:20px;}h1{font-size:18px;color:#1a73e8;}table{width:100%;border-collapse:collapse;font-size:12px;}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;}th{background:#f1f3f4;}.f{font-weight:bold;}.fecha{color:#666;font-size:11px;margin-bottom:16px;}</style></head><body>');
        win.document.write('<h1>Actividad General - Curso ' + curso + '</h1>');
        win.document.write('<div class="fecha">Generado: ' + getToday() + '</div>');
        win.document.write('<table><tr><th>N°</th><th>Matrícula</th><th>Nombre</th><th>Asistencia</th><th>Tareas</th><th>Evaluaciones</th><th>Total</th></tr>');
        resultados.forEach(function(r, i) {
            win.document.write('<tr><td>' + (i+1) + '</td><td>' + r.estudiante.matricula + '</td><td>' + r.estudiante.nombre +
                '</td><td>' + r.ptsAsistencia.toFixed(1) + '</td><td>' + r.ptsTareas.toFixed(1) +
                '</td><td>' + r.ptsEvaluaciones.toFixed(1) + '</td><td class="f">' + r.total.toFixed(1) + '</td></tr>');
        });
        win.document.write('</table>');
        win.document.write('<p style="margin-top:20px;font-size:11px;color:#999;">Asistencia: 4.2 c/u | Tareas: 1.8 c/u | Evaluaciones: 10 c/u</p>');
        win.document.write('</body></html>');
        win.document.close();
        win.print();
    }

    // ===== NOTAS POR CURSO (Ponderado) =====
    var ASISTENCIA_SEMANAS = 12;
    var EVAL_COUNT = 3;
    var TAREA_COUNT = 11;

    function calcularNotas(curso) {
        var estudiantes = db.estudiantes.filter(function(e) { return e.curso === curso; });
        estudiantes.sort(function(a, b) { return a.nombre.localeCompare(b.nombre); });

        return estudiantes.map(function(est) {
            // Asistencia: 50% distribuido en 12 semanas
            var asistencias = db.asistencia.filter(function(a) { return a.estudianteId === est.id; });
            var semanasPresente = asistencias.filter(function(a) { return a.estado === 'Presente'; }).length;
            var semanasTotal = Math.max(asistencias.length, ASISTENCIA_SEMANAS);
            var puntosAsistencia = Math.min((semanasPresente / ASISTENCIA_SEMANAS) * 50, 50);

            // Evaluaciones: 30% distribuido en 3 evaluaciones (10% c/u)
            var evaluaciones = db.evaluaciones.filter(function(e) { return e.estudianteId === est.id; });
            var puntosEval = 0;
            evaluaciones.forEach(function(ev) {
                puntosEval += (ev.puntaje / 100) * (30 / EVAL_COUNT);
            });

            // Tareas: 20% distribuido en 11 tareas
            var tareas = db.tareas.filter(function(t) { return t.estudianteId === est.id; });
            var puntosTareas = 0;
            tareas.forEach(function(t) {
                puntosTareas += (t.puntaje / 100) * (20 / TAREA_COUNT);
            });

            var notaFinal = Math.round((puntosAsistencia + puntosEval + puntosTareas) * 100) / 100;

            return {
                estudiante: est,
                semanasPresente: semanasPresente,
                puntosAsistencia: Math.round(puntosAsistencia * 100) / 100,
                puntosEval: Math.round(puntosEval * 100) / 100,
                puntosTareas: Math.round(puntosTareas * 100) / 100,
                notaFinal: notaFinal
            };
        });
    }

    function renderNotas() {
        var curso = document.getElementById('notasCurso').value;
        var resultados = calcularNotas(curso);
        var tbody = document.getElementById('notasTableBody');
        var empty = document.getElementById('notasEmpty');
        var titulo = document.getElementById('notasTitulo');

        titulo.textContent = 'Notas - Curso ' + curso;

        if (resultados.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        tbody.innerHTML = resultados.map(function(r, i) {
            var nf = r.notaFinal;
            var colorClass = nf >= 70 ? 'puntaje-high' : (nf >= 40 ? 'puntaje-mid' : 'puntaje-low');
            return '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td><strong>' + escHtml(r.estudiante.matricula) + '</strong></td>' +
                '<td>' + escHtml(r.estudiante.nombre) + '</td>' +
                '<td>' + r.puntosAsistencia.toFixed(1) + '</td>' +
                '<td>' + r.puntosEval.toFixed(1) + '</td>' +
                '<td>' + r.puntosTareas.toFixed(1) + '</td>' +
                '<td class="' + colorClass + '"><strong>' + nf.toFixed(1) + '</strong></td>' +
                '</tr>';
        }).join('');
    }

    function exportNotasExcel() {
        var curso = document.getElementById('notasCurso').value;
        var resultados = calcularNotas(curso);
        if (resultados.length === 0) { showToast('No hay datos para exportar', 'error'); return; }

        var html = '<table>' +
            '<tr><th>N°</th><th>Matrícula</th><th>Nombre</th><th>Asistencia /50</th><th>Evaluaciones /30</th><th>Tareas /20</th><th>Nota Final /100</th></tr>';

        resultados.forEach(function(r, i) {
            html += '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td>' + r.estudiante.matricula + '</td>' +
                '<td>' + r.estudiante.nombre + '</td>' +
                '<td>' + r.puntosAsistencia.toFixed(1) + '</td>' +
                '<td>' + r.puntosEval.toFixed(1) + '</td>' +
                '<td>' + r.puntosTareas.toFixed(1) + '</td>' +
                '<td>' + r.notaFinal.toFixed(1) + '</td>' +
                '</tr>';
        });
        html += '</table>';

        var blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'notas_curso_' + curso + '_' + getToday() + '.xls';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Excel exportado', 'success');
    }

    function exportNotasPDF() {
        var curso = document.getElementById('notasCurso').value;
        var resultados = calcularNotas(curso);
        if (resultados.length === 0) { showToast('No hay datos para exportar', 'error'); return; }

        var win = window.open('', '_blank');
        win.document.write('<html><head><title>Notas Curso ' + curso + '</title>');
        win.document.write('<style>' +
            'body{font-family:Arial,sans-serif;padding:20px;}' +
            'h1{font-size:18px;color:#1a73e8;}' +
            'table{width:100%;border-collapse:collapse;font-size:12px;}' +
            'th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;}' +
            'th{background:#f1f3f4;font-weight:600;}' +
            '.f{font-weight:bold;}' +
            '.fecha{color:#666;font-size:11px;margin-bottom:16px;}' +
            '</style></head><body>');
        win.document.write('<h1>Notas - Curso ' + curso + '</h1>');
        win.document.write('<div class="fecha">Generado: ' + getToday() + '</div>');
        win.document.write('<table>' +
            '<tr><th>N°</th><th>Matrícula</th><th>Nombre</th><th>Asistencia /50</th><th>Evaluaciones /30</th><th>Tareas /20</th><th>Nota Final /100</th></tr>');

        resultados.forEach(function(r, i) {
            win.document.write('<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td>' + r.estudiante.matricula + '</td>' +
                '<td>' + r.estudiante.nombre + '</td>' +
                '<td>' + r.puntosAsistencia.toFixed(1) + '</td>' +
                '<td>' + r.puntosEval.toFixed(1) + '</td>' +
                '<td>' + r.puntosTareas.toFixed(1) + '</td>' +
                '<td class="f">' + r.notaFinal.toFixed(1) + '</td>' +
                '</tr>');
        });
        win.document.write('</table>');
        win.document.write('<p style="margin-top:20px;font-size:11px;color:#999;">' +
            'Asistencia: 50% (12 semanas) | Evaluaciones: 30% (3 eval.) | Tareas: 20% (11 tareas)</p>');
        win.document.write('</body></html>');
        win.document.close();
        win.print();
    }

    // ===== MODAL =====
    function openModal(title, bodyHTML) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = bodyHTML;
        document.getElementById('modalOverlay').classList.remove('hidden');
    }

    function closeModal() {
        document.getElementById('modalOverlay').classList.add('hidden');
    }

    // ===== EDIT FUNCTIONS =====
    function editEstudiante(id) {
        const e = getEstudiante(id);
        if (!e) return;
        openModal('Editar Estudiante', `
            <div class="form-group">
                <label>Nombre Completo</label>
                <input type="text" id="editNombre" value="${escHtml(e.nombre)}">
            </div>
            <div class="form-group">
                <label>Matrícula / Carnet</label>
                <input type="text" id="editMatricula" value="${escHtml(e.matricula)}">
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="editEmail" value="${escHtml(e.email)}">
            </div>
            <div class="form-group">
                <label>Carrera</label>
                <input type="text" id="editCarrera" value="${escHtml(e.carrera)}">
            </div>
            <div class="form-group">
                <label>Curso</label>
                <select id="editCurso">
                    <option value="">Seleccionar...</option>
                    <option value="A" ${e.curso === 'A' ? 'selected' : ''}>A</option>
                    <option value="B" ${e.curso === 'B' ? 'selected' : ''}>B</option>
                    <option value="C" ${e.curso === 'C' ? 'selected' : ''}>C</option>
                    <option value="D" ${e.curso === 'D' ? 'selected' : ''}>D</option>
                </select>
            </div>
            <button class="btn btn-primary" onclick="app.saveEditEstudiante('${id}')">Guardar Cambios</button>
        `);
    }

    function saveEditEstudiante(id) {
        const nombre = document.getElementById('editNombre').value.trim();
        const matricula = document.getElementById('editMatricula').value.trim();
        if (!nombre || !matricula) {
            showToast('Nombre y matrícula son obligatorios', 'error');
            return;
        }
        updateEstudiante(id, { nombre, matricula, email: document.getElementById('editEmail').value.trim(), carrera: document.getElementById('editCarrera').value.trim(), curso: document.getElementById('editCurso').value });
        closeModal();
    }

    function editTarea(id) {
        const t = db.tareas.find(t => t.id === id);
        if (!t) return;
        openModal('Editar Tarea', `
            <div class="form-group">
                <label>Estudiante</label>
                <select id="editTareaEstudiante">${db.estudiantes.map(e => `<option value="${e.id}" ${e.id === t.estudianteId ? 'selected' : ''}>${escHtml(e.nombre)} (${escHtml(e.matricula)})</option>`).join('')}</select>
            </div>
            <div class="form-group">
                <label>Nombre de la Tarea</label>
                <input type="text" id="editTareaNombre" value="${escHtml(t.nombre)}">
            </div>
            <div class="form-group">
                <label>Fecha</label>
                <input type="date" id="editTareaFecha" value="${t.fecha}">
            </div>
            <div class="form-group">
                <label>Puntaje (0-100)</label>
                <input type="number" id="editTareaPuntaje" min="0" max="100" step="0.1" value="${t.puntaje}">
            </div>
            <button class="btn btn-primary" onclick="app.saveEditTarea('${id}')">Guardar Cambios</button>
        `);
    }

    function saveEditTarea(id) {
        const estudianteId = document.getElementById('editTareaEstudiante').value;
        const nombre = document.getElementById('editTareaNombre').value.trim();
        const fecha = document.getElementById('editTareaFecha').value;
        const puntaje = parseFloat(document.getElementById('editTareaPuntaje').value);
        if (!nombre || !fecha || isNaN(puntaje)) { showToast('Complete todos los campos', 'error'); return; }
        updateTarea(id, { estudianteId, nombre, fecha, puntaje });
        closeModal();
    }

    function editEvaluacion(id) {
        const ev = db.evaluaciones.find(e => e.id === id);
        if (!ev) return;
        openModal('Editar Evaluación', `
            <div class="form-group">
                <label>Estudiante</label>
                <select id="editEvalEstudiante">${db.estudiantes.map(e => `<option value="${e.id}" ${e.id === ev.estudianteId ? 'selected' : ''}>${escHtml(e.nombre)} (${escHtml(e.matricula)})</option>`).join('')}</select>
            </div>
            <div class="form-group">
                <label>Nombre de la Evaluación</label>
                <input type="text" id="editEvalNombre" value="${escHtml(ev.nombre)}">
            </div>
            <div class="form-group">
                <label>Fecha</label>
                <input type="date" id="editEvalFecha" value="${ev.fecha}">
            </div>
            <div class="form-group">
                <label>Puntaje (0-100)</label>
                <input type="number" id="editEvalPuntaje" min="0" max="100" step="0.1" value="${ev.puntaje}">
            </div>
            <button class="btn btn-primary" onclick="app.saveEditEvaluacion('${id}')">Guardar Cambios</button>
        `);
    }

    function saveEditEvaluacion(id) {
        const estudianteId = document.getElementById('editEvalEstudiante').value;
        const nombre = document.getElementById('editEvalNombre').value.trim();
        const fecha = document.getElementById('editEvalFecha').value;
        const puntaje = parseFloat(document.getElementById('editEvalPuntaje').value);
        if (!nombre || !fecha || isNaN(puntaje)) { showToast('Complete todos los campos', 'error'); return; }
        updateEvaluacion(id, { estudianteId, nombre, fecha, puntaje });
        closeModal();
    }

    function editAsistencia(id) {
        const a = db.asistencia.find(a => a.id === id);
        if (!a) return;
        openModal('Editar Asistencia', `
            <div class="form-group">
                <label>Estudiante</label>
                <select id="editAsisEstudiante">${db.estudiantes.map(e => `<option value="${e.id}" ${e.id === a.estudianteId ? 'selected' : ''}>${escHtml(e.nombre)} (${escHtml(e.matricula)})</option>`).join('')}</select>
            </div>
            <div class="form-group">
                <label>Fecha</label>
                <input type="date" id="editAsisFecha" value="${a.fecha}">
            </div>
            <div class="form-group">
                <label>Estado</label>
                <select id="editAsisEstado">
                    <option value="Presente" ${a.estado === 'Presente' ? 'selected' : ''}>Presente</option>
                    <option value="Ausente" ${a.estado === 'Ausente' ? 'selected' : ''}>Ausente</option>
                    <option value="Justificado" ${a.estado === 'Justificado' ? 'selected' : ''}>Justificado</option>
                </select>
            </div>
            <button class="btn btn-primary" onclick="app.saveEditAsistencia('${id}')">Guardar Cambios</button>
        `);
    }

    function saveEditAsistencia(id) {
        const estudianteId = document.getElementById('editAsisEstudiante').value;
        const fecha = document.getElementById('editAsisFecha').value;
        const estado = document.getElementById('editAsisEstado').value;
        if (!fecha) { showToast('Seleccione una fecha', 'error'); return; }
        updateAsistencia(id, { estudianteId, fecha, estado });
        closeModal();
    }

    // ===== EXPORT / IMPORT =====
    function exportData() {
        const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `regacad_export_${getToday()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Datos exportados', 'success');
    }

    function importData(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.estudiantes || !data.tareas || !data.evaluaciones || !data.asistencia) {
                    showToast('Archivo inválido', 'error');
                    return;
                }
                if (!confirm('¿Importar datos? Se reemplazarán todos los datos actuales.')) return;
                db = data;
                saveDB();
                renderAll();
                showToast('Datos importados exitosamente', 'success');
            } catch (err) {
                showToast('Error al leer el archivo', 'error');
            }
        };
        reader.readAsText(file);
    }

    // ===== CSV IMPORT =====
    function importCSV(text, defaultCurso) {
        if (!db) { showToast('Sistema inicializando...', 'error'); return; }
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            showToast('El CSV debe tener encabezado y al menos una fila', 'error');
            return;
        }

        const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
        const idxMatricula = headers.findIndex(h => h.includes('matricula') || h.includes('carnet'));
        const idxNombre = headers.findIndex(h => h.includes('nombre'));
        const idxEmail = headers.findIndex(h => h.includes('email') || h.includes('correo'));
        const idxCarrera = headers.findIndex(h => h.includes('carrera'));
        const idxCurso = headers.findIndex(h => h === 'curso');

        if (idxMatricula === -1 || idxNombre === -1) {
            showToast('El CSV debe tener columnas: matricula y nombre', 'error');
            return;
        }

        let imported = 0;
        let errors = 0;

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(';');
            const matricula = (cols[idxMatricula] || '').trim();
            const nombre = (cols[idxNombre] || '').trim();
            if (!matricula || !nombre) { errors++; continue; }

            const email = idxEmail >= 0 ? (cols[idxEmail] || '').trim() : '';
            const carrera = idxCarrera >= 0 ? (cols[idxCarrera] || '').trim() : '';
            const curso = idxCurso >= 0 && cols[idxCurso] ? cols[idxCurso].trim() : (defaultCurso || '');

            if (db.estudiantes.some(e => e.matricula === matricula)) { errors++; continue; }

            db.estudiantes.push({
                id: genId(),
                nombre,
                matricula,
                email,
                carrera,
                curso,
                fechaRegistro: new Date().toISOString().split('T')[0]
            });
            imported++;
        }

        saveDB();
        renderAll();
        if (imported > 0) {
            showToast(`${imported} estudiantes importados${errors > 0 ? `, ${errors} omitidos` : ''}`, 'success');
        } else {
            showToast('No se importaron estudiantes. Verifique el formato.', 'error');
        }
    }

    function clearAllData() {
        if (!db) return;
        if (!confirm('¿Está seguro? Se eliminarán TODOS los datos. Esta acción no se puede deshacer.')) return;
        if (!confirm('¿Está realmente seguro? Todos los estudiantes, tareas, evaluaciones y asistencias serán eliminados.')) return;
        db = { estudiantes: [], tareas: [], evaluaciones: [], asistencia: [] };
        saveDB();
        renderAll();
        document.getElementById('reporteResultado').classList.add('hidden');
        showToast('Todos los datos han sido eliminados', 'info');
    }

    // ===== NAVIGATION =====
    function navigateTo(sectionId) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.getElementById(sectionId).classList.add('active');
        document.querySelector(`.nav-link[data-section="${sectionId}"]`).classList.add('active');
        document.getElementById('sidebar').classList.remove('open');
    }

    // ===== AUTO BACKUP =====
    var autoBackupInterval = null;

    function startAutoBackup() {
        if (autoBackupInterval) clearInterval(autoBackupInterval);
        autoBackupInterval = setInterval(function() {
            if (!db) return;
            try {
                localStorage.setItem('regacad_autobackup', JSON.stringify(db));
            } catch(e) {}
        }, 30000);
    }

    // ===== INIT =====
    function init() {
        var today = getToday();
        document.getElementById('tareaFecha').value = today;
        document.getElementById('evalFecha').value = today;
        document.getElementById('asisFecha').value = today;

        // Setup all form handlers (they will work once db is loaded)
        setupEventHandlers();

        // Load DB asynchronously
        loadDB().then(function(data) {
            db = data;
            // Migration: ensure curso field exists
            db.estudiantes.forEach(function(e) { if (!e.curso) e.curso = ''; });
            saveDB();
            renderAll();
            startAutoBackup();

            try {
                var ab = localStorage.getItem('regacad_autobackup');
                if (ab) {
                    var restored = JSON.parse(ab);
                    if (restored && restored.estudiantes && restored.estudiantes.length > db.estudiantes.length) {
                        if (confirm('Se encontró una copia de seguridad con más datos. ¿Restaurar?')) {
                            db = restored;
                            saveDB();
                            renderAll();
                            showToast('Copia de seguridad restaurada', 'success');
                        }
                    }
                }
            } catch(e) {}

            console.log('RegAcad v1.1 - IndexedDB: ' + db.estudiantes.length + ' estudiantes');
        }).catch(function() {
            showToast('Error al cargar la base de datos', 'error');
        });
    }

    function setupEventHandlers() {
        var today = getToday();

        document.getElementById('formEstudiante').addEventListener('submit', function(e) {
            e.preventDefault();
            const nombre = document.getElementById('estNombre').value.trim();
            const matricula = document.getElementById('estMatricula').value.trim();
            if (!nombre || !matricula) { showToast('Nombre y matrícula son obligatorios', 'error'); return; }
            const curso = document.getElementById('estCurso').value;
            if (!curso) { showToast('Seleccione un curso', 'error'); return; }
            addEstudiante({
                nombre,
                matricula,
                email: document.getElementById('estEmail').value.trim(),
                carrera: document.getElementById('estCarrera').value.trim(),
                curso
            });
            this.reset();
            document.getElementById('estNombre').focus();
        });

        document.getElementById('formTarea').addEventListener('submit', function(e) {
            e.preventDefault();
            const estudianteId = document.getElementById('tareaEstudiante').value;
            const nombre = document.getElementById('tareaNombre').value.trim();
            const fecha = document.getElementById('tareaFecha').value;
            const puntaje = parseFloat(document.getElementById('tareaPuntaje').value);
            if (!estudianteId) { showToast('Seleccione un estudiante', 'error'); return; }
            if (!nombre || !fecha || isNaN(puntaje)) { showToast('Complete todos los campos', 'error'); return; }
            addTarea({ estudianteId, nombre, fecha, puntaje });
            this.reset();
            document.getElementById('tareaFecha').value = today;
            document.getElementById('tareaNombre').focus();
        });

        document.getElementById('formEvaluacion').addEventListener('submit', function(e) {
            e.preventDefault();
            const estudianteId = document.getElementById('evalEstudiante').value;
            const nombre = document.getElementById('evalNombre').value.trim();
            const fecha = document.getElementById('evalFecha').value;
            const puntaje = parseFloat(document.getElementById('evalPuntaje').value);
            if (!estudianteId) { showToast('Seleccione un estudiante', 'error'); return; }
            if (!nombre || !fecha || isNaN(puntaje)) { showToast('Complete todos los campos', 'error'); return; }
            addEvaluacion({ estudianteId, nombre, fecha, puntaje });
            this.reset();
            document.getElementById('evalFecha').value = today;
            document.getElementById('evalNombre').focus();
        });

        document.getElementById('formAsistencia').addEventListener('submit', function(e) {
            e.preventDefault();
            const estudianteId = document.getElementById('asisEstudiante').value;
            const fecha = document.getElementById('asisFecha').value;
            const estado = document.getElementById('asisEstado').value;
            if (!estudianteId) { showToast('Seleccione un estudiante', 'error'); return; }
            if (!fecha) { showToast('Seleccione una fecha', 'error'); return; }
            addAsistencia({ estudianteId, fecha, estado });
            document.getElementById('asisFecha').value = today;
        });

        // Quick Attendance
        document.getElementById('rapidaFecha').value = today;

        document.getElementById('rapidaFecha').addEventListener('change', function() {
            renderAsistenciaRapida();
        });

        document.getElementById('rapidaCurso').addEventListener('change', function() {
            renderAsistenciaRapida();
        });

        document.getElementById('btnTodosPresente').addEventListener('click', function() {
            var radios = document.querySelectorAll('#asistenciaRapidaBody input[value="Presente"]');
            radios.forEach(function(r) { r.checked = true; });
        });

        document.getElementById('btnTodosAusente').addEventListener('click', function() {
            var radios = document.querySelectorAll('#asistenciaRapidaBody input[value="Ausente"]');
            radios.forEach(function(r) { r.checked = true; });
        });

        document.getElementById('btnTodosJustificado').addEventListener('click', function() {
            var radios = document.querySelectorAll('#asistenciaRapidaBody input[value="Justificado"]');
            radios.forEach(function(r) { r.checked = true; });
        });

        document.getElementById('btnGuardarAsistenciaRapida').addEventListener('click', function() {
            var fecha = document.getElementById('rapidaFecha').value;
            if (!fecha) { showToast('Seleccione una fecha', 'error'); return; }

            var grupos = document.querySelectorAll('#asistenciaRapidaBody .radio-group');
            if (grupos.length === 0) { showToast('No hay estudiantes para registrar', 'error'); return; }

            var guardados = 0;
            grupos.forEach(function(g) {
                var estudianteId = g.dataset.estudiante;
                var seleccionado = g.querySelector('input[type="radio"]:checked');
                if (!seleccionado) return;
                var estado = seleccionado.value;

                var existing = db.asistencia.find(function(a) { return a.estudianteId === estudianteId && a.fecha === fecha; });
                if (existing) {
                    existing.estado = estado;
                } else {
                    db.asistencia.push({
                        id: genId(),
                        estudianteId: estudianteId,
                        fecha: fecha,
                        estado: estado
                    });
                }
                guardados++;
            });

            saveDB();
            renderAll();
            showToast('Asistencia guardada: ' + guardados + ' estudiantes', 'success');
        });

        // Generate report
        document.getElementById('btnGenerarReporte').addEventListener('click', function() {
            const estudianteId = document.getElementById('reporteEstudiante').value;
            const tipo = document.getElementById('reporteTipo').value;
            if (!estudianteId) { showToast('Seleccione un estudiante', 'error'); return; }
            renderReporte(estudianteId, tipo);
        });

        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                navigateTo(this.dataset.section);
            });
        });

        // Menu toggle
        document.getElementById('menuToggle').addEventListener('click', function() {
            document.getElementById('sidebar').classList.toggle('open');
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function(e) {
            const sidebar = document.getElementById('sidebar');
            const toggle = document.getElementById('menuToggle');
            if (window.innerWidth <= 768 &&
                !sidebar.contains(e.target) &&
                !toggle.contains(e.target) &&
                sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        });

        // CSV Import
        document.getElementById('btnImportarCSV').addEventListener('click', function() {
            const fileInput = document.getElementById('csvFileInput');
            const defaultCurso = document.getElementById('csvDefaultCurso').value;
            if (!fileInput.files || !fileInput.files[0]) {
                showToast('Seleccione un archivo CSV', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) { importCSV(e.target.result, defaultCurso); };
            reader.readAsText(fileInput.files[0]);
            fileInput.value = '';
        });

        // Search
        document.getElementById('searchEstudiantes').addEventListener('input', renderEstudiantes);

        // Filters
        document.getElementById('filterTareaEstudiante').addEventListener('change', renderTareas);
        document.getElementById('filterEvalEstudiante').addEventListener('change', renderEvaluaciones);
        document.getElementById('filterAsisEstudiante').addEventListener('change', renderAsistencia);
        document.getElementById('filterAsisFecha').addEventListener('change', renderAsistencia);

        // Modal close
        document.getElementById('modalClose').addEventListener('click', closeModal);
        document.getElementById('modalOverlay').addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });

        // FAB
        document.getElementById('fabMenu').addEventListener('click', function() {
            document.getElementById('fabOptions').classList.toggle('hidden');
        });

        document.querySelectorAll('.fab-option').forEach(btn => {
            btn.addEventListener('click', function() {
                const action = this.dataset.action;
                document.getElementById('fabOptions').classList.add('hidden');
                if (action === 'export') exportData();
                else if (action === 'import') document.getElementById('importFileInput').click();
                else if (action === 'clear') clearAllData();
            });
        });

        document.getElementById('importFileInput').addEventListener('change', function(e) {
            if (this.files && this.files[0]) importData(this.files[0]);
            this.value = '';
        });

        // Actividad por Curso
        document.getElementById('btnGenerarActividad').addEventListener('click', function() {
            renderActividad();
        });

        document.getElementById('btnExportActExcel').addEventListener('click', function() {
            exportActividadExcel();
        });

        document.getElementById('btnExportActPDF').addEventListener('click', function() {
            exportActividadPDF();
        });

        // Notas por Curso
        document.getElementById('btnGenerarNotas').addEventListener('click', function() {
            renderNotas();
        });

        document.getElementById('btnExportarExcel').addEventListener('click', function() {
            exportNotasExcel();
        });

        document.getElementById('btnExportarPDF').addEventListener('click', function() {
            exportNotasPDF();
        });

        // Keyboard shortcut: Escape to close modal
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeModal();
        });

        // Service Worker registration
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(function() {});
        }
    }

    // Expose to global scope for inline onclick
    window.app = {
        deleteEstudiante,
        editEstudiante,
        saveEditEstudiante,
        deleteTarea,
        editTarea,
        saveEditTarea,
        deleteEvaluacion,
        editEvaluacion,
        saveEditEvaluacion,
        deleteAsistencia,
        editAsistencia,
        saveEditAsistencia
    };

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
