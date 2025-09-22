/**
 * Lógica para el Dashboard de Monitoreo de Emergencias
 * Fecha: 21 de septiembre de 2025
 * Descripción: Este script gestiona la visualización de alertas y unidades de emergencia
 * en un mapa y una tabla, permitiendo la interacción en tiempo real.
 */

document.addEventListener('DOMContentLoaded', () => {

    // ===================================================================================
    // --- 1. CONFIGURACIÓN Y ESTADO INICIAL ---
    // ===================================================================================

    // --- Constantes de la Aplicación ---
    const API_BASE_URL = 'https://api.loralink.live';
    const API_KEY = 'linkONxM0Jn';

    // --- Referencias a Elementos del DOM ---
    const tableBody = document.getElementById('alerts-table-body');
    const assignDialog = document.getElementById('assign-unit-dialog');
    const userDialog = document.getElementById('user-details-dialog');
    const userDialogContent = document.getElementById('user-details-content');
    const selectUnit = document.getElementById('select-unit');
    const btnConfirmAssign = document.getElementById('btn-confirm-assign');
    const btnCancelAssign = document.getElementById('btn-cancel-assign');
    const btnClearAlerts = document.getElementById('clear-alerts-btn');

    // --- Iconos Personalizados para el Mapa ---
    const iconAccidente = L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-dot marker-red'></div>", iconSize: [20, 20], iconAnchor: [10, 10] });
    const iconEnCamino = L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-dot marker-orange'></div>", iconSize: [20, 20], iconAnchor: [10, 10] });
    const iconUnidad = L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-dot marker-blue'></div>", iconSize: [20, 20], iconAnchor: [10, 10] });
    
    // --- Variables para guardar el estado de la aplicación ---
    let selectedAlertId = null;  // Guarda el ID de la alerta que se está gestionando
    let markers = {};            // Guarda los marcadores de las alertas
    let unitMarkers = {};        // Guarda los marcadores de las unidades
    let kinCatalog = [];         // Guarda el catálogo de parentescos para los contactos


    // ===================================================================================
    // --- 2. INICIALIZACIÓN DEL MAPA (LEAFLET) ---
    // ===================================================================================
    
    // Capas base del mapa (calles y satélite)
    const mapaCalles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    const mapaSatelital = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    });

    // Creación del mapa
    const map = L.map('map', {
        center: [13.7942, -88.8965], // Centrado en El Salvador
        zoom: 9,
        layers: [mapaCalles] // La capa de calles se muestra por defecto
    });

    // Control para cambiar entre las capas del mapa
    const baseMaps = {
        "Calles": mapaCalles,
        "Satélite": mapaSatelital
    };
    L.control.layers(baseMaps).addTo(map);

    // Pequeño truco para que el mapa se redibuje correctamente si estaba oculto al cargar
    setTimeout(() => map.invalidateSize(), 100);


    // ===================================================================================
    // --- 3. LÓGICA DE COMUNICACIÓN CON LA API ---
    // ===================================================================================

    /**
     * Función central para todas las llamadas a la API.
     * Añade la API Key y maneja errores.
     */
    async function apiFetch(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
            ...options.headers,
        };
        const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Error desconocido" }));
            console.error(`Error en API [${endpoint}]:`, errorData);
            throw new Error(`Error en la API: ${response.statusText}`);
        }
        
        // Si la respuesta no tiene contenido (ej. un DELETE exitoso), devuelve null
        if (response.status === 204 || response.headers.get("content-length") === "0") {
            return null;
        }

        return response.json();
    }

    /**
     * Obtiene todos los datos necesarios para el dashboard y luego llama a la función
     * que dibuja todo en la pantalla.
     */
    async function fetchDashboardData() {
        try {
            // 1. Obtenemos los datos primarios (alertas, unidades, parentescos)
            const [alerts, baseUnits, kins] = await Promise.all([
                apiFetch('/emergencies'),
                apiFetch('/emergency-units'),
                apiFetch('/catalogs/kin-catalog')
            ]);
            kinCatalog = kins;

            if (!baseUnits || baseUnits.length === 0) {
                renderDashboard(alerts, []);
                return;
            }

            // 2. Para cada unidad, pedimos sus estadísticas para saber si está ocupada
            const statsPromises = baseUnits.map(unit =>
                apiFetch(`/emergency-units/${unit.emergency_unit_id}/stats`)
                    .catch(e => ({ active_emergencies: 0 }))
            );
            const allStats = await Promise.all(statsPromises);

            // 3. Combinamos la información de las unidades con sus estadísticas
            const unitsWithStats = baseUnits.map((unit, index) => ({
                ...unit,
                active_emergencies: allStats[index].active_emergencies
            }));

            // 4. Con todos los datos listos, dibujamos el dashboard
            renderDashboard(alerts, unitsWithStats);

        } catch (error) {
            console.error("Error al cargar datos del dashboard:", error);
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Error al cargar los datos.</td></tr>`;
        }
    }


    // ===================================================================================
    // --- 4. LÓGICA DE RENDERIZADO (DIBUJAR EN PANTALLA) ---
    // ===================================================================================

    /**
     * Traduce un ID de estado (ej. 1) a un texto legible (ej. 'accidente').
     */
    function traducirStatus(statusId) {
        const statuses = { 1: 'accidente', 2: 'en_camino', 3: 'atendido' };
        return statuses[statusId] || 'desconocido';
    }

    /**
     * Dibuja y actualiza toda la interfaz: la tabla y los marcadores en el mapa.
     */
function renderDashboard(alerts, units) {
    // 1. Limpia todo lo anterior (sin cambios)
    Object.values(markers).forEach(marker => marker.remove());
    Object.values(unitMarkers).forEach(marker => marker.remove());
    unitMarkers = {};
    tableBody.innerHTML = '';

    // --- PASO CLAVE: Filtramos para obtener solo las alertas activas ---
    // Un reporte activo es cualquiera cuyo 'status' NO sea 3 (atendido).
    const activeAlerts = alerts.filter(alert => alert.status !== 3);

    // 2. Dibuja las filas de la tabla USANDO LA LISTA FILTRADA
    if (!activeAlerts || !activeAlerts.length) {
        // Mensaje actualizado para reflejar que no hay reportes ACTIVOS
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay reportes activos.</td></tr>`;
    } else {
        // Usamos 'activeAlerts' en lugar de 'alerts'
        activeAlerts.forEach(alert => {
            const statusText = traducirStatus(alert.status);
            const typeText = alert.accident_type?.description || 'N/A';
            const userName = alert.user?.name || 'N/A';
            const userId = alert.user?.user_id;
            const assignedUnits = alert.assigned_unit_rel ? [alert.assigned_unit_rel] : [];
            
            // La lógica de los marcadores de alertas no cambia, ya que no mostraba los 'atendidos'
            if (statusText !== 'atendido' && alert.latitud && alert.longitud) {
                const icon = statusText === 'en_camino' ? iconEnCamino : iconAccidente;
                const unitsPopupText = assignedUnits.map(u => u.name).join(', ') || 'N/A';
                const popupTexto = `<b>Tipo:</b> ${typeText}<br><b>Unidad:</b> ${unitsPopupText}`;
                const marker = L.marker([alert.latitud, alert.longitud], { icon }).addTo(map).bindPopup(popupTexto);
                markers[alert.emergency_id] = marker;
            }

            // La creación de la fila sigue igual
            const row = document.createElement('tr');
            row.id = `row-${alert.emergency_id}`;
            const statusClass = statusText.replace('_', '-');
            const unitsTableText = assignedUnits.length > 0 ? assignedUnits.map(u => `<span class="unit-tag">${u.name}</span>`).join(' ') : '<span class="muted">N/A</span>';
            const userHtml = userId ? `<a class="user-link" data-user-id="${userId}">${userName}</a>` : `<span class="muted">${userName}</span>`;

            row.innerHTML = `
                <td class="type">${typeText}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>${unitsTableText}</td>
                <td class="muted">${userHtml}</td>
                <td class="muted">${new Date(alert.timestamp).toLocaleString('es-SV')}</td>
                <td class="actions">
                    <button class="btn btn-primary btn-asignar" data-id="${alert.emergency_id}">Asignar</button>
                    <button class="btn btn-success btn-atendido" data-id="${alert.emergency_id}">Atendido</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // 3. Dibuja los marcadores de las UNIDADES en el mapa (sin cambios)
    if (units && units.length > 0) {
        units.forEach(unit => {
            if (unit.latitud && unit.longitud) {
                const isAvailable = unit.active_emergencies === 0;
                const statusText = isAvailable ? 'Disponible' : 'Ocupada';
                const popupTexto = `<b>Unidad:</b> ${unit.name}<br><b>Estado:</b> ${statusText}`;
                const marker = L.marker([unit.latitud, unit.longitud], { icon: iconUnidad }).addTo(map).bindPopup(popupTexto);
                unitMarkers[unit.emergency_unit_id] = marker;
            }
        });
    }

    // 4. Asigna los eventos a los nuevos elementos USANDO LA LISTA FILTRADA
    assignEvents(activeAlerts, units);
}
    /**
     * Dibuja los detalles de un usuario en el diálogo modal.
     */
    function renderUserDetails(user) {
        if (!user) {
            userDialogContent.innerHTML = '<h3>Error al cargar datos del usuario.</h3>';
            return;
        }
        const conditionsHtml = user.conditions?.length ? user.conditions.map(c => `<li>${c.description}</li>`).join('') : '<li>Ninguna registrada</li>';
        const contactsHtml = user.emergency_contacts?.length ? user.emergency_contacts.map(c => {
            const kinshipName = kinCatalog.find(k => k.kin_id === c.kin)?.kin_name || 'N/A';
            return `<li><b>${c.contact_name}</b> (${kinshipName}): ${c.contact_phone}</li>`;
        }).join('') : '<li>Ninguno registrado</li>';

        userDialogContent.innerHTML = `
            <button id="close-user-dialog" class="btn-close">X</button>
            <h3>Detalles de Usuario</h3>
            <h4>Información General</h4>
            <ul>
                <li><b>Nombre:</b> ${user.name || 'N/A'}</li>
                <li><b>Teléfono:</b> ${user.phone || 'N/A'}</li>
                <li><b>Nacimiento:</b> ${user.birthday || 'N/A'}</li>
            </ul>
            <h4>Condiciones Médicas</h4>
            <ul>${conditionsHtml}</ul>
            <h4>Contactos de Emergencia</h4>
            <ul>${contactsHtml}</ul>
        `;
        document.getElementById('close-user-dialog').onclick = () => userDialog.close();
    }


    // ===================================================================================
    // --- 5. MANEJO DE EVENTOS E INTERACTIVIDAD ---
    // ===================================================================================

    /**
     * Asigna todos los eventos a los elementos recién creados en la tabla.
     */
    function assignEvents(alerts, units) {
        // --- Interacción Mapa-Tabla (resaltar al pasar el cursor) ---
        document.querySelectorAll('#alerts-table-body tr').forEach(row => {
            const emergencyId = row.id.replace('row-', '');
            const marker = markers[emergencyId];
            if (!marker) return;

            row.onmouseenter = () => {
                row.classList.add('highlighted');
                marker.getElement()?.classList.add('highlighted-marker');
            };
            row.onmouseleave = () => {
                row.classList.remove('highlighted');
                marker.getElement()?.classList.remove('highlighted-marker');
            };
            marker.on('mouseover', () => row.classList.add('highlighted'));
            marker.on('mouseout', () => row.classList.remove('highlighted'));
        });

        // --- Clic en el nombre de un usuario para ver detalles ---
        document.querySelectorAll('.user-link').forEach(link => {
            link.onclick = async (e) => {
                const userId = e.target.dataset.userId;
                userDialogContent.innerHTML = '<h3>Cargando información...</h3>';
                userDialog.showModal();
                try {
                    const user = await apiFetch(`/users/${userId}`);
                    renderUserDetails(user);
                } catch (error) {
                    userDialogContent.innerHTML = '<h3>Error al cargar datos</h3><div class="dialog-actions"><button id="close-user-dialog" class="btn">Cerrar</button></div>';
                    document.getElementById('close-user-dialog').onclick = () => userDialog.close();
                }
            };
        });

        // --- Clic en el botón "Asignar" ---
        document.querySelectorAll('.btn-asignar').forEach(btn => {
            btn.onclick = (e) => {
                selectedAlertId = e.target.dataset.id;
                
                // Filtra las unidades que están disponibles (active_emergencies es 0)
                const availableUnits = units.filter(u => u.active_emergencies == 0);
                
                if (availableUnits.length > 0) {
                    selectUnit.innerHTML = availableUnits.map(u => `<option value="${u.emergency_unit_id}">${u.name}</option>`).join('');
                    assignDialog.showModal();
                } else {
                    alert('No hay unidades disponibles para asignar a esta emergencia.');
                }
            };
        });

        // --- Clic en el botón "Atendido" ---
        document.querySelectorAll('.btn-atendido').forEach(btn => {
            btn.onclick = async (e) => {
                const emergencyId = e.target.dataset.id;
                try {
                    // Actualiza la emergencia: estado 3 (atendida) y sin unidad asignada
                    await apiFetch(`/emergencies/${emergencyId}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            status: 3,
                            assigned_unit: null
                        })
                    });
                } catch (error) {
                    console.error("Error al marcar como atendido:", error);
                } finally {
                    fetchDashboardData();
                }
            };
        });
    }

    // --- Clics en los botones de los diálogos y acciones globales ---

    // Clic en "Cancelar" en el diálogo de asignación
    btnCancelAssign.onclick = () => assignDialog.close();

    // Clic en "Confirmar" en el diálogo de asignación
    btnConfirmAssign.onclick = async () => {
        const unit_id = parseInt(selectUnit.value, 10);
        if (selectedAlertId && unit_id) {
            try {
                // Actualiza la emergencia: estado 2 (en camino) y la unidad seleccionada
                await apiFetch(`/emergencies/${selectedAlertId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ 
                        status: 2,
                        assigned_unit: unit_id 
                    })
                });
            } catch (error) {
                console.error("Error al asignar unidad:", error);
            } finally {
                assignDialog.close();
                fetchDashboardData();
            }
        }
    };
    
    // Clic en el botón para borrar todas las alertas
    btnClearAlerts.onclick = async () => {
        if (confirm('¿Estás seguro de que quieres borrar TODOS los reportes? Esta acción no se puede deshacer.')) {
            try {
                const alertsResponse = await apiFetch('/emergencies');
                // Crea una promesa de borrado para cada alerta
                const deletePromises = alertsResponse.map(alert => 
                    apiFetch(`/emergencies/${alert.emergency_id}`, { method: 'DELETE' })
                );
                await Promise.all(deletePromises); // Espera a que todas se borren
            } catch (error) {
                console.error("Error al borrar las alertas:", error);
            } finally {
                fetchDashboardData();
            }
        }
    };


    // ===================================================================================
    // --- 6. EJECUCIÓN INICIAL Y ACTUALIZACIÓN PERIÓDICA ---
    // ===================================================================================

    // Llama a la función principal una vez para cargar los datos al inicio
    fetchDashboardData();

    // Configura un intervalo para que se actualice automáticamente cada 5 segundos
    setInterval(fetchDashboardData, 5000);

});