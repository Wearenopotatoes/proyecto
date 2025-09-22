// js/main.js

// --- Importaciones de los Módulos ---
import { apiFetch } from './apiService.js';
import { initializeMap, drawMarkers, flyToLocation, alertMarkers } from './mapManager.js';
import { renderTable, renderUserDetails, renderEmergencyDetails } from './uiRenderer.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- Referencias a Elementos del DOM ---
    const tableBody = document.getElementById('alerts-table-body');
    const assignDialog = document.getElementById('assign-unit-dialog');
    const userDialog = document.getElementById('user-details-dialog');
    const userDialogContent = document.getElementById('user-details-content');
    const emergencyDialog = document.getElementById('emergency-details-dialog');
    const emergencyDialogContent = document.getElementById('emergency-details-content');
    const selectUnit = document.getElementById('select-unit');
    const btnConfirmAssign = document.getElementById('btn-confirm-assign');
    const btnCancelAssign = document.getElementById('btn-cancel-assign');
    const btnClearAlerts = document.getElementById('clear-alerts-btn');

    // --- Estado de la Aplicación ---
    let selectedAlertId = null;
    let kinCatalog = [];
    let currentAlerts = [];
    let currentUnits = [];
    const map = initializeMap(); // Inicializamos el mapa y guardamos la instancia

    /**
     * Función principal que obtiene todos los datos y coordina el renderizado.
     */
    async function fetchAndRender() {
        try {
            const [alerts, baseUnits, kins] = await Promise.all([
                apiFetch('/emergencies'),
                apiFetch('/emergency-units'),
                apiFetch('/catalogs/kin-catalog')
            ]);
            
            kinCatalog = kins || [];
            currentAlerts = alerts || [];
            
            if (!baseUnits || baseUnits.length === 0) {
                currentUnits = [];
            } else {
                const statsPromises = baseUnits.map(unit =>
                    apiFetch(`/emergency-units/${unit.emergency_unit_id}/stats`).catch(e => ({ active_emergencies: 0 }))
                );
                const allStats = await Promise.all(statsPromises);
                currentUnits = baseUnits.map((unit, index) => ({
                    ...unit,
                    active_emergencies: allStats[index].active_emergencies
                }));
            }
            
            // Renderiza la tabla y los marcadores
            renderTable(tableBody, currentAlerts);
            drawMarkers(map, currentAlerts, currentUnits);
            assignEvents();

                    // Calculamos los totales
            const activeAlertsCount = currentAlerts.filter(a => a.status !== 3).length;
            const availableUnitsCount = currentUnits.filter(u => u.active_emergencies === 0).length;

                   // Actualizamos el HTML
            document.getElementById('active-alerts-count').textContent = activeAlertsCount;
            document.getElementById('available-units-count').textContent = availableUnitsCount;

        } catch (error) {
            console.error("Error fatal al cargar el dashboard:", error);
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Error al cargar los datos.</td></tr>`;
        }
    }

    /**
     * Asigna todos los eventos a los elementos de la interfaz.
     */
    function assignEvents() {
        // --- Interacción Mapa-Tabla ---
        document.querySelectorAll('#alerts-table-body tr').forEach(row => {
            const emergencyId = row.id.replace('row-', '');
            const marker = alertMarkers[emergencyId];
            if (!marker) return;
            
            row.onmouseenter = () => { marker.getElement()?.classList.add('highlighted-marker'); };
            row.onmouseleave = () => { marker.getElement()?.classList.remove('highlighted-marker'); };
        });

        // --- Clics en los botones de la tabla ---
        tableBody.onclick = (e) => {
            const target = e.target.closest('button, a');
            if (!target) return;

            const id = target.dataset.id || target.dataset.userId;

            if (target.matches('.btn-details')) handleDetailsClick(id);
            if (target.matches('.btn-asignar')) handleAssignClick(id);
            if (target.matches('.btn-atendido')) handleAttendedClick(id);
            if (target.matches('.user-link')) handleUserClick(id);
        };
    }

    // --- Manejadores de Clics (Handlers) ---

    async function handleDetailsClick(id) {
        emergencyDialogContent.innerHTML = '<h3>Cargando detalles...</h3>';
        emergencyDialog.showModal();
        try {
            const details = await apiFetch(`/emergencies/${id}`);
            if (details.latitud && details.longitud) {
                flyToLocation(map, details.latitud, details.longitud);
            }
            renderEmergencyDetails(emergencyDialogContent, details);
        } catch (error) {
            emergencyDialogContent.innerHTML = '<h3>Error al cargar detalles.</h3>';
        }
    }

    function handleAssignClick(id) {
        selectedAlertId = id;
        const availableUnits = currentUnits.filter(u => u.active_emergencies == 0);
        if (availableUnits.length > 0) {
            selectUnit.innerHTML = availableUnits.map(u => `<option value="${u.emergency_unit_id}">${u.name}</option>`).join('');
            assignDialog.showModal();
        } else {
            alert('No hay unidades disponibles.');
        }
    }

    async function handleAttendedClick(id) {
        try {
            await apiFetch(`/emergencies/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 3, assigned_unit: null })
            });
        } catch (error) {
            console.error("Error al marcar como atendido:", error);
        } finally {
            fetchAndRender();
        }
    }

    async function handleUserClick(id) {
        userDialogContent.innerHTML = '<h3>Cargando información...</h3>';
        userDialog.showModal();
        try {
            const user = await apiFetch(`/users/${id}`);
            renderUserDetails(userDialogContent, user, kinCatalog);
        } catch (error) {
            userDialogContent.innerHTML = '<h3>Error al cargar datos del usuario.</h3>';
        }
    }

    // --- Eventos de Botones Globales y de Diálogos ---
    
    btnCancelAssign.onclick = () => assignDialog.close();

    btnConfirmAssign.onclick = async () => {
        const unit_id = parseInt(selectUnit.value, 10);
        if (selectedAlertId && unit_id) {
            try {
                await apiFetch(`/emergencies/${selectedAlertId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ status: 2, assigned_unit: unit_id })
                });
            } catch (error) {
                console.error("Error al asignar unidad:", error);
            } finally {
                assignDialog.close();
                fetchAndRender();
            }
        }
    };
    
    btnClearAlerts.onclick = async () => {
        if (confirm('¿Estás seguro de que quieres borrar TODOS los reportes?')) {
            try {
                const deletePromises = currentAlerts.map(alert => 
                    apiFetch(`/emergencies/${alert.emergency_id}`, { method: 'DELETE' })
                );
                await Promise.all(deletePromises);
            } catch (error) {
                console.error("Error al borrar las alertas:", error);
            } finally {
                fetchAndRender();
            }
        }
    };

    // --- Arranque y Ciclo de Actualización ---
    fetchAndRender();
    setInterval(fetchAndRender, 5000);
});