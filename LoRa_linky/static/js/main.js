// main.js - Dashboard principal mejorado

import { apiFetch } from './apiService.js';
import { initializeMap, drawMarkers, flyToLocation, alertMarkers } from './mapManager.js';
import { renderTable, renderUserDetails, renderEmergencyDetails } from './uiRenderer.js';
import { CONFIG, UTILS } from './config.js';
import { notificationManager } from './notifications.js';
import { AnalyticsManager } from './analyticsManager.js';

document.addEventListener('DOMContentLoaded', () => {
    // Referencias DOM
    const tableBody = document.getElementById('alerts-table-body');
    const searchInput = document.getElementById('search-input');
    const assignDialog = document.getElementById('assign-unit-dialog');
    const userDialog = document.getElementById('user-details-dialog');
    const userDialogContent = document.getElementById('user-details-content');
    const emergencyDialog = document.getElementById('emergency-details-dialog');
    const emergencyDialogContent = document.getElementById('emergency-details-content');
    const selectUnit = document.getElementById('select-unit');
    const btnConfirmAssign = document.getElementById('btn-confirm-assign');
    const btnCancelAssign = document.getElementById('btn-cancel-assign');
    const filterStatus = document.getElementById('filter-status');
    const filterType = document.getElementById('filter-type');
    const btnExportCSV = document.getElementById('btn-export-csv');

    // Estado de la aplicación
    let selectedAlertId = null;
    let kinCatalog = [];
    let currentAlerts = [];
    let currentUnits = [];
    let accidentTypes = [];
    const map = initializeMap();
    const analytics = new AnalyticsManager();

    // ============================================
    // RELOJ EN TIEMPO REAL (GMT-6)
    // ============================================
    function initClock() {
        const clockElement = document.getElementById('live-clock');
        const dateElement = document.getElementById('live-date');
        
        function updateClock() {
            const now = new Date();
            const offset = CONFIG.GMT_OFFSET * 60; // GMT-6 en minutos
            const localTime = new Date(now.getTime() + offset * 60 * 1000);
            
            const hours = String(localTime.getUTCHours()).padStart(2, '0');
            const minutes = String(localTime.getUTCMinutes()).padStart(2, '0');
            const seconds = String(localTime.getUTCSeconds()).padStart(2, '0');
            
            const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            
            const dayName = days[localTime.getUTCDay()];
            const day = localTime.getUTCDate();
            const monthName = months[localTime.getUTCMonth()];
            
            if (clockElement) {
                clockElement.textContent = `${hours}:${minutes}:${seconds}`;
            }
            if (dateElement) {
                dateElement.textContent = `${dayName}, ${day} ${monthName}`;
            }
        }
        
        updateClock();
        setInterval(updateClock, 1000);
    }

    // ============================================
    // CARGA DE DATOS
    // ============================================
    async function fetchAndRender() {
        try {
            const [alerts, baseUnits, kins, types] = await Promise.all([
                apiFetch('/emergencies'),
                apiFetch('/emergency-units'),
                apiFetch('/catalogs/kin-catalog'),
                apiFetch('/catalogs/accident-types')
            ]);
            
            kinCatalog = kins || [];
            accidentTypes = types || [];
            
            const previousAlertsCount = currentAlerts.length;
            currentAlerts = alerts || [];
            
            // Detectar nuevas emergencias
            if (previousAlertsCount > 0 && currentAlerts.length > previousAlertsCount) {
                notificationManager.checkNewEmergencies(currentAlerts);
            }
            
            // Cargar estadísticas de unidades
            if (!baseUnits || baseUnits.length === 0) {
                currentUnits = [];
            } else {
                const statsPromises = baseUnits.map(unit =>
                    apiFetch(`/emergency-units/${unit.emergency_unit_id}/stats`)
                    .catch(() => ({ active_emergencies: 0 }))
                );
                const allStats = await Promise.all(statsPromises);
                currentUnits = baseUnits.map((unit, index) => ({
                    ...unit,
                    active_emergencies: allStats[index].active_emergencies
                }));
            }
            
            // Actualizar analytics
            analytics.updateData(currentAlerts, currentUnits);
            
            updateUI();

        } catch (error) {
            console.error("Error al cargar datos:", error);
            notificationManager.showError("Error al cargar los datos del dashboard");
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Error al cargar los datos.</td></tr>`;
        }
    }

    // ============================================
    // ACTUALIZACIÓN DE UI
    // ============================================
    function updateUI() {
        const searchTerm = searchInput.value.toLowerCase();
        const statusFilter = filterStatus?.value || 'all';
        const typeFilter = filterType?.value || 'all';
        
        let filteredAlerts = currentAlerts.filter(alert => {
            // Filtro de búsqueda
            const userName = alert.user?.name?.toLowerCase() || '';
            const accidentType = alert.accident_type?.description?.toLowerCase() || '';
            const matchesSearch = userName.includes(searchTerm) || accidentType.includes(searchTerm);
            
            // Filtro de estado
            const matchesStatus = statusFilter === 'all' || alert.status === parseInt(statusFilter);
            
            // Filtro de tipo
            const matchesType = typeFilter === 'all' || alert.tipo_accidente === parseInt(typeFilter);
            
            return matchesSearch && matchesStatus && matchesType;
        });

        renderTable(tableBody, filteredAlerts, showElapsedTime);
        drawMarkers(map, filteredAlerts, currentUnits, handleMarkerClick);
        updateCounters();
        updateAdvancedMetrics();
        assignEvents();
    }
    
    // ============================================
    // CONTADORES Y MÉTRICAS
    // ============================================
    function updateCounters() {
        const metrics = analytics.getOverviewMetrics();
        
        document.getElementById('active-alerts-count').textContent = metrics.active;
        document.getElementById('available-units-count').textContent = metrics.availableUnits;
        
        // Métricas adicionales
        const pendingEl = document.getElementById('pending-count');
        const resolvedEl = document.getElementById('resolved-count');
        
        if (pendingEl) pendingEl.textContent = metrics.pending;
        if (resolvedEl) resolvedEl.textContent = metrics.resolved;
    }

    function updateAdvancedMetrics() {
        const responseTime = analytics.getResponseTimeMetrics();
        const avgTimeEl = document.getElementById('avg-response-time');
        
        if (avgTimeEl && responseTime.count > 0) {
            avgTimeEl.textContent = `${responseTime.average} min`;
        }
    }

    // ============================================
    // TIEMPO TRANSCURRIDO
    // ============================================
    function showElapsedTime(timestamp) {
        const now = new Date();
        const emergencyTime = new Date(timestamp + 'Z');
        const diffMs = now - emergencyTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        
        if (diffHours > 0) {
            return `${diffHours}h ${mins}m`;
        }
        return `${diffMins}m`;
    }

    // ============================================
    // EVENTOS
    // ============================================
    function assignEvents() {
        // Sincronización de hover entre tabla y mapa
        document.querySelectorAll('#alerts-table-body tr').forEach(row => {
            const emergencyId = row.id.replace('row-', '');
            const marker = alertMarkers[emergencyId];
            if (!marker) return;
            
            row.onmouseenter = () => { 
                marker.getElement()?.classList.add('highlighted-marker'); 
            };
            row.onmouseleave = () => { 
                marker.getElement()?.classList.remove('highlighted-marker'); 
            };
        });

        // Búsqueda y filtros
        searchInput.oninput = updateUI;
        if (filterStatus) filterStatus.onchange = updateUI;
        if (filterType) filterType.onchange = updateUI;
        
        // Clicks en la tabla
        tableBody.onclick = (e) => {
            const target = e.target.closest('button, a');
            if (!target) return;

            const id = target.dataset.id || target.dataset.userId;

            if (target.matches('.btn-details')) handleDetailsClick(id);
            if (target.matches('.btn-asignar')) handleAssignClick(id);
            if (target.matches('.btn-atendido')) handleAttendedClick(id);
            if (target.matches('.user-link')) handleUserClick(id);
            if (target.matches('.btn-route')) handleRouteClick(id);
        };
    }
    
    // ============================================
    // HANDLERS DE CLICKS
    // ============================================
    function handleMarkerClick(emergencyId) {
        const row = document.getElementById(`row-${emergencyId}`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.classList.add('row-focused');
            setTimeout(() => row.classList.remove('row-focused'), 1500);
        }
    }

    async function handleDetailsClick(id) {
        emergencyDialogContent.innerHTML = '<div class="loading-spinner"></div><h3>Cargando detalles...</h3>';
        emergencyDialog.showModal();
        try {
            const details = await apiFetch(`/emergencies/${id}`);
            if (details.latitud && details.longitud) {
                flyToLocation(map, details.latitud, details.longitud);
            }
            
            // Calcular unidad más cercana
            const nearest = analytics.getNearestUnit(details.latitud, details.longitud);
            
            renderEmergencyDetails(emergencyDialogContent, details, nearest);
        } catch (error) {
            emergencyDialogContent.innerHTML = '<h3>Error al cargar detalles.</h3>';
            notificationManager.showError('Error al cargar detalles de la emergencia');
        }
    }

    function handleAssignClick(id) {
        selectedAlertId = id;
        const emergency = currentAlerts.find(a => a.emergency_id === parseInt(id));
        
        if (!emergency) return;
        
        // Ordenar unidades por distancia
        const unitsWithDistance = currentUnits
            .filter(u => u.active_emergencies === 0)
            .map(unit => ({
                ...unit,
                distance: UTILS.calculateDistance(
                    emergency.latitud, 
                    emergency.longitud, 
                    unit.latitud, 
                    unit.longitud
                )
            }))
            .sort((a, b) => a.distance - b.distance);
        
        if (unitsWithDistance.length > 0) {
            selectUnit.innerHTML = unitsWithDistance.map(u => 
                `<option value="${u.emergency_unit_id}">
                    ${u.name} - ${u.distance.toFixed(2)} km
                </option>`
            ).join('');
            assignDialog.showModal();
        } else {
            notificationManager.showError('No hay unidades disponibles en este momento');
        }
    }

    async function handleAttendedClick(id) {
        if (!confirm('¿Confirmar que esta emergencia ha sido atendida?')) return;
        
        try {
            await apiFetch(`/emergencies/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 3, assigned_unit: null })
            });
            notificationManager.showSuccess('Emergencia marcada como atendida');
        } catch (error) {
            console.error("Error al marcar como atendido:", error);
            notificationManager.showError('Error al actualizar el estado');
        } finally {
            fetchAndRender();
        }
    }

    async function handleUserClick(id) {
        userDialogContent.innerHTML = '<div class="loading-spinner"></div><h3>Cargando información...</h3>';
        userDialog.showModal();
        try {
            const user = await apiFetch(`/users/${id}`);
            renderUserDetails(userDialogContent, user, kinCatalog);
        } catch (error) {
            userDialogContent.innerHTML = '<h3>Error al cargar datos del usuario.</h3>';
            notificationManager.showError('Error al cargar información del usuario');
        }
    }

    function handleRouteClick(id) {
        const emergency = currentAlerts.find(a => a.emergency_id === parseInt(id));
        if (!emergency || !emergency.assigned_unit_rel) {
            notificationManager.showInfo('Esta emergencia no tiene unidad asignada');
            return;
        }
        
        const unit = emergency.assigned_unit_rel;
        
        // Crear línea de ruta en el mapa
        const latlngs = [
            [unit.latitud, unit.longitud],
            [emergency.latitud, emergency.longitud]
        ];
        
        const polyline = L.polyline(latlngs, {
            color: '#2d7dff',
            weight: 3,
            opacity: 0.7,
            dashArray: '10, 10'
        }).addTo(map);
        
        // Ajustar vista del mapa
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
        
        // Calcular distancia
        const distance = UTILS.calculateDistance(
            unit.latitud, unit.longitud,
            emergency.latitud, emergency.longitud
        );
        
        notificationManager.showInfo(`Distancia: ${distance.toFixed(2)} km - Tiempo estimado: ${Math.ceil(distance * 2)} min`);
        
        // Remover línea después de 10 segundos
        setTimeout(() => polyline.remove(), 10000);
    }
    
    // ============================================
    // DIÁLOGOS
    // ============================================
    btnCancelAssign.onclick = () => assignDialog.close();

    btnConfirmAssign.onclick = async () => {
        const unit_id = parseInt(selectUnit.value, 10);
        if (selectedAlertId && unit_id) {
            try {
                await apiFetch(`/emergencies/${selectedAlertId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ status: 2, assigned_unit: unit_id })
                });
                notificationManager.showSuccess('Unidad asignada exitosamente');
            } catch (error) {
                console.error("Error al asignar unidad:", error);
                notificationManager.showError('Error al asignar la unidad');
            } finally {
                assignDialog.close();
                fetchAndRender();
            }
        }
    };

    // ============================================
    // EXPORTACIÓN
    // ============================================
    if (btnExportCSV) {
        btnExportCSV.onclick = () => {
            analytics.exportToCSV();
            notificationManager.showSuccess('Reporte exportado exitosamente');
        };
    }

    // ============================================
    // FILTROS DINÁMICOS
    // ============================================
    function populateFilters() {
        if (filterType && accidentTypes.length > 0) {
            filterType.innerHTML = '<option value="all">Todos los tipos</option>' +
                accidentTypes.map(type => 
                    `<option value="${type.accident_type_id}">${type.description}</option>`
                ).join('');
        }
    }

    // ============================================
    // INICIALIZACIÓN
    // ============================================
    initClock();
    populateFilters();
    fetchAndRender();
    
    // Polling automático
    setInterval(fetchAndRender, CONFIG.REFRESH.DASHBOARD);
    
    // Actualizar tiempos transcurridos cada minuto
    setInterval(() => {
        document.querySelectorAll('.elapsed-time').forEach(el => {
            const timestamp = el.dataset.timestamp;
            if (timestamp) {
                el.textContent = showElapsedTime(timestamp);
            }
        });
    }, 60000);
});