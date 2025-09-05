document.addEventListener('DOMContentLoaded', () => {
    // --- Referencias a Elementos del DOM ---
    const map = L.map('map').setView([13.7942, -88.8965], 9);
    const marcadores = L.layerGroup().addTo(map);
    const listaEmergencias = document.getElementById('lista-emergencias');
    const modal = document.getElementById('modal-unidades');
    const selectUnidad = document.getElementById('select-unidad');
    const btnConfirmar = document.getElementById('btn-confirmar-asignacion');
    const btnCancelar = document.getElementById('btn-cancelar-asignacion');

    // --- Estado de la Aplicación ---
    let unidadesDisponibles = [];
    let reporteIdSeleccionado = null;

    // --- Inicialización ---
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Carga la lista de unidades al iniciar
    cargarUnidades();
    
    // --- Funciones de API ---
    async function cargarUnidades() {
        try {
            const response = await fetch('/api/unidades');
            unidadesDisponibles = await response.json();
        } catch (error) {
            console.error("Error al cargar unidades:", error);
        }
    }

    async function cambiarEstado(reporteId, nuevoEstado, unidad = null) {
        try {
            const response = await fetch('/api/actualizar_estado', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: reporteId, estado: nuevoEstado, unidad: unidad })
            });
            if (response.ok) {
                actualizarDashboard();
            }
        } catch (error) {
            console.error("Error al actualizar estado:", error);
        }
    }
    
    // --- Lógica del Modal ---
    function abrirModalAsignacion(reporteId) {
        reporteIdSeleccionado = reporteId;
        selectUnidad.innerHTML = unidadesDisponibles.map(u => `<option value="${u}">${u}</option>`).join('');
        modal.style.display = 'flex';
    }

    function cerrarModal() {
        modal.style.display = 'none';
        reporteIdSeleccionado = null;
    }

    btnCancelar.addEventListener('click', cerrarModal);
    btnConfirmar.addEventListener('click', () => {
        if (reporteIdSeleccionado) {
            const unidadSeleccionada = selectUnidad.value;
            cambiarEstado(reporteIdSeleccionado, 'En Camino', unidadSeleccionada);
            cerrarModal();
        }
    });

    // --- Lógica Principal del Dashboard ---
    function traducirTipoAccidente(tipoId) {
        const tipos = { '1': 'Colisión', '2': 'Incendio', '3': 'Derrumbe', '4': 'Otro' };
        return tipos[String(tipoId)] || 'Desconocido';
    }

    async function actualizarDashboard() {
        try {
            const response = await fetch('/api/datos');
            const reportes = await response.json();

            marcadores.clearLayers();
            listaEmergencias.innerHTML = '';

            reportes.forEach(reporte => {
                const lat = parseFloat(reporte.latitud);
                const lon = parseFloat(reporte.longitud);
                const id = reporte.timestamp;
                const unidad = reporte.unidad || 'Sin asignar';

                // Crear marcador en el mapa
                if (!isNaN(lat) && !isNaN(lon)) {
                    const popupTexto = `<b>Tipo:</b> ${traducirTipoAccidente(reporte.tipo_accidente)}<br><b>Unidad:</b> ${unidad}`;
                    L.marker([lat, lon]).addTo(marcadores).bindPopup(popupTexto);
                }

                // Crear card en la lista
                const card = document.createElement('div');
                card.className = 'card-emergencia';
                card.id = `card-${id}`;
                card.innerHTML = `
                    <div class="card-header">
                        <h3>${traducirTipoAccidente(reporte.tipo_accidente)}</h3>
                        <span class="estado ${reporte.estado.toLowerCase().replace(' ', '-')}">${reporte.estado}</span>
                    </div>
                    <div class="card-body">
                        <p class="card-unidad"><b>Unidad:</b> <span>${unidad}</span></p>
                        <p><b>Hora:</b> ${new Date(id * 1e3).toLocaleString('es-SV')}</p>
                    </div>
                    <div class="card-acciones">
                        <button class="btn-asignar" data-id="${id}">Asignar</button>
                        <button class="btn-completar" data-id="${id}">Completar</button>
                    </div>
                `;
                listaEmergencias.appendChild(card);
            });

            // Añadir listeners a los botones después de crear todas las cards
            document.querySelectorAll('.btn-asignar').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    abrirModalAsignacion(e.target.dataset.id);
                });
            });
            document.querySelectorAll('.btn-completar').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    cambiarEstado(e.target.dataset.id, 'Completado');
                });
            });

        } catch (error) {
            console.error("No se pudo actualizar el dashboard:", error);
        }
    }

    actualizarDashboard();
    setInterval(actualizarDashboard, 5000);
});